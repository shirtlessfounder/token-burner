import "server-only";

import { createHmac } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";

type TokenBurnerDatabase = NodePgDatabase<typeof schema>;

type DatabaseOptions = {
  database?: TokenBurnerDatabase;
};

type TimestampedDatabaseOptions = DatabaseOptions & {
  now?: Date;
};

type ClaimCodeRecord = {
  id: string;
  code: string;
  status: string;
  expiresAt: Date;
  claimedHumanId: string | null;
  createdAt: Date;
};

export type VerifiedOwnerToken = {
  id: string;
  humanId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

const resolveDatabase = async (
  database?: TokenBurnerDatabase,
): Promise<TokenBurnerDatabase> => {
  if (database) {
    return database;
  }

  const client = await import("../db/client");
  return client.db;
};

const getOwnerTokenHashSecret = (): string => {
  const ownerTokenHashSecret = process.env.OWNER_TOKEN_HASH_SECRET;

  if (ownerTokenHashSecret) {
    return ownerTokenHashSecret;
  }

  throw new Error(
    "Set OWNER_TOKEN_HASH_SECRET before using owner-token auth helpers.",
  );
};

const claimCodeSelection = {
  id: schema.claimCodes.id,
  code: schema.claimCodes.code,
  status: schema.claimCodes.status,
  expiresAt: schema.claimCodes.expiresAt,
  claimedHumanId: schema.claimCodes.claimedHumanId,
  createdAt: schema.claimCodes.createdAt,
};

export const hashOwnerToken = (ownerToken: string): string =>
  createHmac("sha256", getOwnerTokenHashSecret())
    .update(ownerToken)
    .digest("hex");

export const verifyOwnerToken = async (
  ownerToken: string,
  { database, now = new Date() }: TimestampedDatabaseOptions = {},
): Promise<VerifiedOwnerToken | null> => {
  const queryDatabase = await resolveDatabase(database);
  const [verifiedOwnerToken] = await queryDatabase
    .update(schema.ownerTokens)
    .set({
      lastUsedAt: now,
    })
    .where(
      and(
        eq(schema.ownerTokens.tokenHash, hashOwnerToken(ownerToken)),
        isNull(schema.ownerTokens.revokedAt),
      ),
    )
    .returning({
      id: schema.ownerTokens.id,
      humanId: schema.ownerTokens.humanId,
      createdAt: schema.ownerTokens.createdAt,
      lastUsedAt: schema.ownerTokens.lastUsedAt,
    });

  return verifiedOwnerToken ?? null;
};

export const validateClaimCode = async (
  code: string,
  { database, now = new Date() }: TimestampedDatabaseOptions = {},
): Promise<ClaimCodeRecord | null> => {
  const queryDatabase = await resolveDatabase(database);
  const [claimCode] = await queryDatabase
    .select(claimCodeSelection)
    .from(schema.claimCodes)
    .where(
      and(
        eq(schema.claimCodes.code, code),
        eq(schema.claimCodes.status, "available"),
        gt(schema.claimCodes.expiresAt, now),
        isNull(schema.claimCodes.claimedHumanId),
      ),
    )
    .limit(1);

  return claimCode ?? null;
};

export const consumeClaimCode = async ({
  code,
  humanId,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & {
  code: string;
  humanId: string;
}): Promise<ClaimCodeRecord | null> => {
  const queryDatabase = await resolveDatabase(database);
  const [claimCode] = await queryDatabase
    .update(schema.claimCodes)
    .set({
      status: "claimed",
      claimedHumanId: humanId,
    })
    .where(
      and(
        eq(schema.claimCodes.code, code),
        eq(schema.claimCodes.status, "available"),
        gt(schema.claimCodes.expiresAt, now),
        isNull(schema.claimCodes.claimedHumanId),
      ),
    )
    .returning(claimCodeSelection);

  return claimCode ?? null;
};
