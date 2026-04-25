import "server-only";

import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

import { type BurnStatus } from "@token-burner/shared";

import * as schema from "../db/schema";

type TokenBurnerDatabase = NodePgDatabase<typeof schema>;

type DatabaseOptions = {
  database?: TokenBurnerDatabase;
};

type TimestampedDatabaseOptions = DatabaseOptions & {
  now?: Date;
};

type ActiveBurnRecord = {
  id: string;
  humanId: string;
  agentInstallationId: string;
  status: BurnStatus;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastHeartbeatAt: Date | null;
};

const activeBurnStatuses = ["queued", "running", "stopping"] as const;
// 60s — short enough that a crashed/killed cli only locks a human out for
// roughly one minute before they can start a new burn (the next start call
// sweeps the stale row before checking the active-burn invariant).
const staleBurnTimeoutMilliseconds = 60 * 1000;

const activeBurnSelection = {
  id: schema.burns.id,
  humanId: schema.burns.humanId,
  agentInstallationId: schema.burns.agentInstallationId,
  status: schema.burns.status,
  createdAt: schema.burns.createdAt,
  startedAt: schema.burns.startedAt,
  finishedAt: schema.burns.finishedAt,
  lastHeartbeatAt: schema.burns.lastHeartbeatAt,
};

const activeBurnTimestampFallback = sql<Date>`coalesce(${schema.burns.lastHeartbeatAt}, ${schema.burns.startedAt}, ${schema.burns.createdAt})`;

const resolveDatabase = async (
  database?: TokenBurnerDatabase,
): Promise<TokenBurnerDatabase> => {
  if (database) {
    return database;
  }

  const client = await import("../db/client");
  return client.db;
};

export class ActiveBurnConflictError extends Error {
  readonly burnId: string;
  readonly status: BurnStatus;

  constructor(activeBurn: ActiveBurnRecord) {
    super(
      `Human ${activeBurn.humanId} already has an active burn (${activeBurn.id}) in ${activeBurn.status}.`,
    );
    this.name = "ActiveBurnConflictError";
    this.burnId = activeBurn.id;
    this.status = activeBurn.status;
  }
}

export const interruptStaleBurns = async ({
  humanId,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & {
  humanId: string;
}): Promise<ActiveBurnRecord[]> => {
  const queryDatabase = await resolveDatabase(database);
  const staleCutoff = new Date(now.getTime() - staleBurnTimeoutMilliseconds);

  return queryDatabase
    .update(schema.burns)
    .set({
      status: "interrupted",
      finishedAt: now,
    })
    .where(
      and(
        eq(schema.burns.humanId, humanId),
        inArray(schema.burns.status, activeBurnStatuses),
        lte(activeBurnTimestampFallback, staleCutoff),
      ),
    )
    .returning(activeBurnSelection);
};

// Sweep across ALL humans. Used by read paths (homepage, live feed) so
// orphaned burns from killed agent sessions disappear from the UI without
// needing a separate cron — the next visitor pays a tiny update cost and
// the DB matches reality.
export const interruptAllStaleBurns = async ({
  database,
  now = new Date(),
}: TimestampedDatabaseOptions = {}): Promise<ActiveBurnRecord[]> => {
  const queryDatabase = await resolveDatabase(database);
  const staleCutoff = new Date(now.getTime() - staleBurnTimeoutMilliseconds);

  return queryDatabase
    .update(schema.burns)
    .set({
      status: "interrupted",
      finishedAt: now,
    })
    .where(
      and(
        inArray(schema.burns.status, activeBurnStatuses),
        lte(activeBurnTimestampFallback, staleCutoff),
      ),
    )
    .returning(activeBurnSelection);
};

export const findActiveBurnForHuman = async ({
  humanId,
  database,
}: DatabaseOptions & {
  humanId: string;
}): Promise<ActiveBurnRecord | null> => {
  const queryDatabase = await resolveDatabase(database);
  const [activeBurn] = await queryDatabase
    .select(activeBurnSelection)
    .from(schema.burns)
    .where(
      and(
        eq(schema.burns.humanId, humanId),
        inArray(schema.burns.status, activeBurnStatuses),
      ),
    )
    .orderBy(desc(schema.burns.lastHeartbeatAt), desc(schema.burns.createdAt))
    .limit(1);

  return activeBurn ?? null;
};

export const ensureNoActiveBurnConflict = async ({
  humanId,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & {
  humanId: string;
}): Promise<void> => {
  await interruptStaleBurns({
    humanId,
    database,
    now,
  });

  const activeBurn = await findActiveBurnForHuman({
    humanId,
    database,
  });

  if (activeBurn) {
    throw new ActiveBurnConflictError(activeBurn);
  }
};
