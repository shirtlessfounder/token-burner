import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  providerFlagshipModels,
  type BurnStatus,
  type PresetId,
  type ProviderId,
  type TerminalBurnStatus,
} from "@token-burner/shared";

import * as schema from "../db/schema";
import { verifyOwnerToken } from "./auth";
import { ensureNoActiveBurnConflict } from "./housekeeping";

type TokenBurnerDatabase = NodePgDatabase<typeof schema>;

type DatabaseOptions = {
  database?: TokenBurnerDatabase;
};

type TimestampedDatabaseOptions = DatabaseOptions & {
  now?: Date;
};

const burnSessionTokenBytes = 32;
const activeBurnStatuses = ["queued", "running", "stopping"] as const;

export class OwnerTokenInvalidError extends Error {
  constructor() {
    super("owner token is invalid or revoked");
    this.name = "OwnerTokenInvalidError";
  }
}

export class BurnSessionInvalidError extends Error {
  constructor() {
    super("burn session is invalid or already finished");
    this.name = "BurnSessionInvalidError";
  }
}

const resolveDatabase = async (
  database?: TokenBurnerDatabase,
): Promise<TokenBurnerDatabase> => {
  if (database) {
    return database;
  }
  const client = await import("../db/client");
  return client.db;
};

const getBurnSessionTokenHashSecret = (): string => {
  const secret = process.env.OWNER_TOKEN_HASH_SECRET;
  if (secret) {
    return secret;
  }
  throw new Error(
    "Set OWNER_TOKEN_HASH_SECRET before using burn session helpers.",
  );
};

export const generateBurnSessionTokenValue = (): string =>
  `tb_burn_${randomBytes(burnSessionTokenBytes).toString("hex")}`;

export const hashBurnSessionToken = (token: string): string =>
  createHmac("sha256", getBurnSessionTokenHashSecret())
    .update(token)
    .digest("hex");

export type StartBurnInput = {
  ownerToken: string;
  agentInstallationId: string;
  provider: ProviderId;
  targetTokens: number;
  presetId?: PresetId | null;
};

export type StartBurnResult = {
  burnId: string;
  burnSessionToken: string;
  status: BurnStatus;
};

export const startBurn = async ({
  ownerToken,
  agentInstallationId,
  provider,
  targetTokens,
  presetId,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & StartBurnInput): Promise<StartBurnResult> => {
  const queryDatabase = await resolveDatabase(database);

  const verified = await verifyOwnerToken(ownerToken, {
    database: queryDatabase,
    now,
  });
  if (!verified) {
    throw new OwnerTokenInvalidError();
  }

  await ensureNoActiveBurnConflict({
    humanId: verified.humanId,
    database: queryDatabase,
    now,
  });

  const burnSessionToken = generateBurnSessionTokenValue();

  const [burn] = await queryDatabase
    .insert(schema.burns)
    .values({
      humanId: verified.humanId,
      agentInstallationId,
      provider,
      model: providerFlagshipModels[provider],
      presetId: presetId ?? null,
      requestedBilledTokenTarget: targetTokens,
      billedTokensConsumed: 0,
      status: "running",
      createdAt: now,
      startedAt: now,
      lastHeartbeatAt: now,
      burnSessionTokenHash: hashBurnSessionToken(burnSessionToken),
    })
    .returning({
      id: schema.burns.id,
      status: schema.burns.status,
    });

  return {
    burnId: burn.id,
    burnSessionToken,
    status: burn.status,
  };
};

type ActiveBurnMatch = {
  id: string;
  status: BurnStatus;
  billedTokensConsumed: number;
  requestedBilledTokenTarget: number;
};

const findActiveBurnBySession = async (
  burnId: string,
  sessionToken: string,
  queryDatabase: TokenBurnerDatabase,
): Promise<ActiveBurnMatch | null> => {
  const [row] = await queryDatabase
    .select({
      id: schema.burns.id,
      status: schema.burns.status,
      billedTokensConsumed: schema.burns.billedTokensConsumed,
      requestedBilledTokenTarget: schema.burns.requestedBilledTokenTarget,
    })
    .from(schema.burns)
    .where(
      and(
        eq(schema.burns.id, burnId),
        eq(
          schema.burns.burnSessionTokenHash,
          hashBurnSessionToken(sessionToken),
        ),
        inArray(schema.burns.status, activeBurnStatuses),
      ),
    )
    .limit(1);

  return row ?? null;
};

export type HeartbeatInput = {
  burnId: string;
  burnSessionToken: string;
  billedTokensConsumed: number;
};

export type HeartbeatResult = {
  ok: true;
  status: BurnStatus;
  billedTokensConsumed: number;
};

export const recordHeartbeat = async ({
  burnId,
  burnSessionToken,
  billedTokensConsumed,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & HeartbeatInput): Promise<HeartbeatResult> => {
  const queryDatabase = await resolveDatabase(database);

  const existing = await findActiveBurnBySession(
    burnId,
    burnSessionToken,
    queryDatabase,
  );
  if (!existing) {
    throw new BurnSessionInvalidError();
  }

  const clampedTarget = existing.requestedBilledTokenTarget;
  const safeBilled = Math.min(
    Math.max(billedTokensConsumed, existing.billedTokensConsumed),
    clampedTarget,
  );

  const [updated] = await queryDatabase
    .update(schema.burns)
    .set({
      billedTokensConsumed: safeBilled,
      lastHeartbeatAt: now,
    })
    .where(eq(schema.burns.id, burnId))
    .returning({
      status: schema.burns.status,
      billedTokensConsumed: schema.burns.billedTokensConsumed,
    });

  return {
    ok: true,
    status: updated.status,
    billedTokensConsumed: updated.billedTokensConsumed,
  };
};

export type RecordBurnEventInput = {
  burnId: string;
  burnSessionToken: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  billedTokensConsumed?: number;
};

export type RecordBurnEventResult = {
  accepted: true;
};

export const recordBurnEvent = async ({
  burnId,
  burnSessionToken,
  eventType,
  eventPayload,
  billedTokensConsumed,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & RecordBurnEventInput): Promise<RecordBurnEventResult> => {
  const queryDatabase = await resolveDatabase(database);

  const existing = await findActiveBurnBySession(
    burnId,
    burnSessionToken,
    queryDatabase,
  );
  if (!existing) {
    throw new BurnSessionInvalidError();
  }

  await queryDatabase.insert(schema.burnEvents).values({
    burnId,
    eventType,
    eventPayload,
    createdAt: now,
  });

  if (typeof billedTokensConsumed === "number") {
    const safeBilled = Math.min(
      Math.max(billedTokensConsumed, existing.billedTokensConsumed),
      existing.requestedBilledTokenTarget,
    );
    await queryDatabase
      .update(schema.burns)
      .set({
        billedTokensConsumed: safeBilled,
        lastHeartbeatAt: now,
      })
      .where(eq(schema.burns.id, burnId));
  }

  return { accepted: true };
};

export type FinishBurnInput = {
  burnId: string;
  burnSessionToken: string;
  status: TerminalBurnStatus;
  billedTokensConsumed: number;
};

export type FinishBurnResult = {
  ok: true;
  status: TerminalBurnStatus;
};

export const finishBurn = async ({
  burnId,
  burnSessionToken,
  status,
  billedTokensConsumed,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & FinishBurnInput): Promise<FinishBurnResult> => {
  const queryDatabase = await resolveDatabase(database);

  const existing = await findActiveBurnBySession(
    burnId,
    burnSessionToken,
    queryDatabase,
  );
  if (!existing) {
    throw new BurnSessionInvalidError();
  }

  const safeBilled = Math.min(
    Math.max(billedTokensConsumed, existing.billedTokensConsumed),
    existing.requestedBilledTokenTarget,
  );

  const [updated] = await queryDatabase
    .update(schema.burns)
    .set({
      billedTokensConsumed: safeBilled,
      status,
      finishedAt: now,
      lastHeartbeatAt: now,
      burnSessionTokenHash: sql`null`,
    })
    .where(eq(schema.burns.id, burnId))
    .returning({
      status: schema.burns.status,
    });

  return {
    ok: true,
    status: updated.status as TerminalBurnStatus,
  };
};
