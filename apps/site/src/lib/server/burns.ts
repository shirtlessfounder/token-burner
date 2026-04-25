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
import { countOutputTokens } from "./tokenize";

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

// Caps how big eventPayload.content can be before the server rejects.
// 500KB is roughly 150k tokens of english at 3.5 chars/token — way more
// than any honest burn step. Above this we assume bug or abuse and reject
// with a clear 413 instead of letting the tokenizer churn or the request
// timeout at vercel's edge.
const maxEventContentChars = 500_000;

export class EventContentTooLargeError extends Error {
  readonly contentChars: number;
  readonly limit = maxEventContentChars;
  constructor(contentChars: number) {
    super(
      `event content too large: ${contentChars} chars exceeds ${maxEventContentChars} limit`,
    );
    this.name = "EventContentTooLargeError";
    this.contentChars = contentChars;
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
  model?: string | null;
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
  model,
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
  const modelToRecord =
    typeof model === "string" && model.trim().length > 0
      ? model.trim()
      : providerFlagshipModels[provider];

  const [burn] = await queryDatabase
    .insert(schema.burns)
    .values({
      humanId: verified.humanId,
      agentInstallationId,
      provider,
      model: modelToRecord,
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
  provider: ProviderId;
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
      provider: schema.burns.provider,
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
  verifiedStepTokens?: number;
  cumulativeTokens: number;
  verified: boolean;
};

const extractContent = (
  eventPayload: Record<string, unknown>,
): string | null => {
  const value = eventPayload.content;
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value;
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

  const content = extractContent(eventPayload);
  if (content !== null && content.length > maxEventContentChars) {
    throw new EventContentTooLargeError(content.length);
  }

  const verifiedStepTokens =
    content === null ? null : countOutputTokens(existing.provider, content);

  await queryDatabase.insert(schema.burnEvents).values({
    burnId,
    eventType,
    eventPayload,
    verifiedOutputTokens: verifiedStepTokens,
    createdAt: now,
  });

  // Atomic update via SQL — avoids the read-then-compute-then-write race
  // when two events arrive concurrently. The verified path increments;
  // the legacy self-reported path takes the max-with-clamp.
  let nextCumulative = existing.billedTokensConsumed;

  if (verifiedStepTokens !== null) {
    const [updated] = await queryDatabase
      .update(schema.burns)
      .set({
        billedTokensConsumed: sql`least(${schema.burns.billedTokensConsumed} + ${verifiedStepTokens}, ${schema.burns.requestedBilledTokenTarget})`,
        lastHeartbeatAt: now,
      })
      .where(eq(schema.burns.id, burnId))
      .returning({
        billedTokensConsumed: schema.burns.billedTokensConsumed,
      });
    nextCumulative = updated.billedTokensConsumed;
  } else if (typeof billedTokensConsumed === "number") {
    const claimed = billedTokensConsumed;
    const [updated] = await queryDatabase
      .update(schema.burns)
      .set({
        billedTokensConsumed: sql`least(greatest(${schema.burns.billedTokensConsumed}, ${claimed}), ${schema.burns.requestedBilledTokenTarget})`,
        lastHeartbeatAt: now,
      })
      .where(eq(schema.burns.id, burnId))
      .returning({
        billedTokensConsumed: schema.burns.billedTokensConsumed,
      });
    nextCumulative = updated.billedTokensConsumed;
  }

  return {
    accepted: true,
    verifiedStepTokens: verifiedStepTokens ?? undefined,
    cumulativeTokens: nextCumulative,
    verified: verifiedStepTokens !== null,
  };
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
