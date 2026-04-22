import "server-only";

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../db/schema";
import {
  consumeClaimCode,
  hashOwnerToken,
  validateClaimCode,
  verifyOwnerToken,
} from "./auth";

type TokenBurnerDatabase = NodePgDatabase<typeof schema>;

type DatabaseOptions = {
  database?: TokenBurnerDatabase;
};

type TimestampedDatabaseOptions = DatabaseOptions & {
  now?: Date;
};

const claimCodeTtlMilliseconds = 15 * 60 * 1000;
const claimCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const claimCodeLength = 8;
const ownerTokenBytes = 32;

export class ClaimCodeInvalidError extends Error {
  constructor() {
    super("claim code is invalid, expired, or already claimed");
    this.name = "ClaimCodeInvalidError";
  }
}

export class OwnerTokenInvalidError extends Error {
  constructor() {
    super("owner token is invalid or revoked");
    this.name = "OwnerTokenInvalidError";
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

const randomFromAlphabet = (length: number, alphabet: string): string => {
  const bytes = randomBytes(length);
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += alphabet[bytes[index] % alphabet.length];
  }
  return result;
};

export const generateClaimCodeValue = (): string =>
  randomFromAlphabet(claimCodeLength, claimCodeAlphabet);

export const generateOwnerTokenValue = (): string =>
  `tb_owner_${randomBytes(ownerTokenBytes).toString("hex")}`;

export type CreatedClaimCode = {
  code: string;
  expiresAt: Date;
};

export const createClaimCode = async ({
  database,
  now = new Date(),
}: TimestampedDatabaseOptions = {}): Promise<CreatedClaimCode> => {
  const queryDatabase = await resolveDatabase(database);
  const expiresAt = new Date(now.getTime() + claimCodeTtlMilliseconds);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateClaimCodeValue();
    try {
      await queryDatabase.insert(schema.claimCodes).values({
        code,
        status: "available",
        expiresAt,
        createdAt: now,
      });
      return { code, expiresAt };
    } catch (error) {
      if (isUniqueViolation(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    "could not mint a unique claim code after 5 attempts — alphabet or retry policy may need tuning",
  );
};

export type RegisterHumanInput = {
  claimCode: string;
  publicHandle: string;
  avatar: string;
  agentLabel: string;
};

export type RegisterHumanResult = {
  humanId: string;
  agentInstallationId: string;
  ownerToken: string;
  handle: string;
  avatar: string;
};

export const registerHumanFromClaim = async ({
  claimCode,
  publicHandle,
  avatar,
  agentLabel,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & RegisterHumanInput): Promise<RegisterHumanResult> => {
  const queryDatabase = await resolveDatabase(database);

  const validClaim = await validateClaimCode(claimCode, {
    database: queryDatabase,
    now,
  });
  if (!validClaim) {
    throw new ClaimCodeInvalidError();
  }

  const [human] = await queryDatabase
    .insert(schema.humans)
    .values({
      publicHandle,
      avatarUrl: avatar,
      createdAt: now,
    })
    .returning({
      id: schema.humans.id,
      publicHandle: schema.humans.publicHandle,
      avatarUrl: schema.humans.avatarUrl,
    });

  const [installation] = await queryDatabase
    .insert(schema.agentInstallations)
    .values({
      humanId: human.id,
      agentLabel,
      createdAt: now,
      lastSeenAt: now,
    })
    .returning({ id: schema.agentInstallations.id });

  const ownerToken = generateOwnerTokenValue();
  await queryDatabase.insert(schema.ownerTokens).values({
    humanId: human.id,
    tokenHash: hashOwnerToken(ownerToken),
    createdAt: now,
    lastUsedAt: now,
  });

  const consumed = await consumeClaimCode({
    code: claimCode,
    humanId: human.id,
    database: queryDatabase,
    now,
  });
  if (!consumed) {
    throw new ClaimCodeInvalidError();
  }

  return {
    humanId: human.id,
    agentInstallationId: installation.id,
    ownerToken,
    handle: human.publicHandle,
    avatar: human.avatarUrl,
  };
};

export type LinkAgentInput = {
  ownerToken: string;
  agentLabel: string;
};

export type LinkAgentResult = {
  humanId: string;
  agentInstallationId: string;
  handle: string;
  avatar: string;
};

export const linkAgentToHuman = async ({
  ownerToken,
  agentLabel,
  database,
  now = new Date(),
}: TimestampedDatabaseOptions & LinkAgentInput): Promise<LinkAgentResult> => {
  const queryDatabase = await resolveDatabase(database);

  const verified = await verifyOwnerToken(ownerToken, {
    database: queryDatabase,
    now,
  });
  if (!verified) {
    throw new OwnerTokenInvalidError();
  }

  const [human] = await queryDatabase
    .select({
      id: schema.humans.id,
      publicHandle: schema.humans.publicHandle,
      avatarUrl: schema.humans.avatarUrl,
    })
    .from(schema.humans)
    .where(eq(schema.humans.id, verified.humanId))
    .limit(1);

  if (!human) {
    throw new OwnerTokenInvalidError();
  }

  const [installation] = await queryDatabase
    .insert(schema.agentInstallations)
    .values({
      humanId: verified.humanId,
      agentLabel,
      createdAt: now,
      lastSeenAt: now,
    })
    .returning({ id: schema.agentInstallations.id });

  return {
    humanId: human.id,
    agentInstallationId: installation.id,
    handle: human.publicHandle,
    avatar: human.avatarUrl,
  };
};

const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "23505") {
    return true;
  }
  if (
    typeof candidate.message === "string" &&
    candidate.message.toLowerCase().includes("duplicate")
  ) {
    return true;
  }
  return false;
};
