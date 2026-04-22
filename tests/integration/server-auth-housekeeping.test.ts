import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { DataType, newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "../../apps/site/src/lib/db/schema";

vi.mock("server-only", () => ({}));

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const migrationPath = path.join(repoRoot, "drizzle/0001_initial.sql");
const fixedNow = new Date("2026-04-21T12:00:00.000Z");
const ownerTokenHashSecret =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

type TestContext = {
  database: TestDatabase;
  pool: { end: () => Promise<void> };
};

type HumanSeed = {
  humanId: string;
  installationId: string;
};

type BurnSeed = {
  burnId: string;
};

const openPools: Array<{ end: () => Promise<void> }> = [];

const createTestDatabase = async (): Promise<TestContext> => {
  const memoryDatabase = newDb({ autoCreateForeignKeyIndices: true });
  memoryDatabase.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    implementation: randomUUID,
  });

  const migrationSql = await readFile(migrationPath, "utf8");
  memoryDatabase.public.none(
    migrationSql.replace(/create extension if not exists "pgcrypto";\n\n/i, ""),
  );

  const adapter = memoryDatabase.adapters.createPg();
  const patchPgMemAdapter = (PgClass: {
    prototype: {
      adaptQuery: (query: unknown, values?: unknown[]) => unknown;
      adaptResults: (query: unknown, results: {
        rows: Array<Record<string, unknown>>;
        fields: Array<{ name: string }>;
      }) => unknown;
    };
  }) => {
    const originalAdaptQuery = PgClass.prototype.adaptQuery;
    const originalAdaptResults = PgClass.prototype.adaptResults;

    PgClass.prototype.adaptQuery = function adaptQueryWithoutDriverTypes(
      query,
      values,
    ) {
      if (typeof query === "string") {
        return originalAdaptQuery.call(this, query, values);
      }

      const sanitizedQuery =
        query && typeof query === "object"
          ? { ...(query as Record<string, unknown>) }
          : query;

      if (sanitizedQuery && typeof sanitizedQuery === "object") {
        delete sanitizedQuery.types;
      }

      return originalAdaptQuery.call(this, sanitizedQuery, values);
    };

    PgClass.prototype.adaptResults = function adaptArrayRowMode(query, results) {
      if (
        query &&
        typeof query === "object" &&
        "rowMode" in (query as Record<string, unknown>) &&
        (query as Record<string, unknown>).rowMode === "array"
      ) {
        return {
          ...results,
          rows: results.rows.map((row) =>
            results.fields.map((field) => row[field.name]),
          ),
          fields: results.fields,
        };
      }

      return originalAdaptResults.call(this, query, results);
    };
  };

  patchPgMemAdapter(adapter.Pool);
  patchPgMemAdapter(adapter.Client);

  const pool = new adapter.Pool();
  const database = drizzle({ client: pool, schema });

  openPools.push(pool);

  return { database, pool };
};

const createOwnerTokenHash = (ownerToken: string) =>
  createHmac("sha256", ownerTokenHashSecret).update(ownerToken).digest("hex");

const seedHuman = async (
  database: TestDatabase,
  {
    humanId = randomUUID(),
    installationId = randomUUID(),
    handle,
    avatarUrl,
  }: {
    humanId?: string;
    installationId?: string;
    handle: string;
    avatarUrl: string;
  },
): Promise<HumanSeed> => {
  await database.insert(schema.humans).values({
    id: humanId,
    publicHandle: handle,
    avatarUrl,
    createdAt: fixedNow,
  });

  await database.insert(schema.agentInstallations).values({
    id: installationId,
    humanId,
    agentLabel: `${handle}-agent`,
    createdAt: fixedNow,
    lastSeenAt: fixedNow,
  });

  return { humanId, installationId };
};

const seedOwnerToken = async (
  database: TestDatabase,
  {
    ownerTokenId = randomUUID(),
    humanId,
    ownerToken,
  }: {
    ownerTokenId?: string;
    humanId: string;
    ownerToken: string;
  },
) => {
  await database.insert(schema.ownerTokens).values({
    id: ownerTokenId,
    humanId,
    tokenHash: createOwnerTokenHash(ownerToken),
    createdAt: fixedNow,
  });
};

const seedClaimCode = async (
  database: TestDatabase,
  {
    claimCodeId = randomUUID(),
    code,
    expiresAt,
    status = "available",
    claimedHumanId = null,
  }: {
    claimCodeId?: string;
    code: string;
    expiresAt: Date;
    status?: string;
    claimedHumanId?: string | null;
  },
) => {
  await database.insert(schema.claimCodes).values({
    id: claimCodeId,
    code,
    status,
    expiresAt,
    claimedHumanId,
    createdAt: fixedNow,
  });
};

const seedBurn = async (
  database: TestDatabase,
  {
    burnId = randomUUID(),
    humanId,
    installationId,
    provider = "openai",
    model = "gpt-5.4",
    status,
    billedTokensConsumed = 0,
    requestedBilledTokenTarget = 100,
    createdAt,
    startedAt = createdAt,
    finishedAt = null,
    lastHeartbeatAt = createdAt,
  }: {
    burnId?: string;
    humanId: string;
    installationId: string;
    provider?: "openai" | "anthropic";
    model?: string;
    status: (typeof schema.burns.$inferInsert)["status"];
    billedTokensConsumed?: number;
    requestedBilledTokenTarget?: number;
    createdAt: Date;
    startedAt?: Date | null;
    finishedAt?: Date | null;
    lastHeartbeatAt?: Date | null;
  },
): Promise<BurnSeed> => {
  await database.insert(schema.burns).values({
    id: burnId,
    humanId,
    agentInstallationId: installationId,
    provider,
    model,
    requestedBilledTokenTarget,
    billedTokensConsumed,
    status,
    createdAt,
    startedAt,
    finishedAt,
    lastHeartbeatAt,
  });

  return { burnId };
};

beforeEach(() => {
  process.env.OWNER_TOKEN_HASH_SECRET = ownerTokenHashSecret;
});

afterEach(async () => {
  delete process.env.OWNER_TOKEN_HASH_SECRET;

  while (openPools.length > 0) {
    const pool = openPools.pop();

    if (pool) {
      await pool.end();
    }
  }
});

describe("server auth and housekeeping helpers", () => {
  it("verifies a valid owner token and returns null for an invalid owner token", async () => {
    const { database } = await createTestDatabase();
    const human = await seedHuman(database, {
      handle: "alice",
      avatarUrl: "https://example.com/alice.png",
    });

    const validOwnerToken = "tb_owner_valid_alice_token";
    await seedOwnerToken(database, {
      humanId: human.humanId,
      ownerToken: validOwnerToken,
    });

    const { verifyOwnerToken } = await import(
      "../../apps/site/src/lib/server/auth"
    );

    const verifiedOwnerToken = await verifyOwnerToken(validOwnerToken, {
      database,
      now: fixedNow,
    });

    expect(verifiedOwnerToken).toMatchObject({
      humanId: human.humanId,
    });

    const [persistedToken] = await database
      .select({
        tokenHash: schema.ownerTokens.tokenHash,
        lastUsedAt: schema.ownerTokens.lastUsedAt,
      })
      .from(schema.ownerTokens);

    expect(persistedToken.tokenHash).toBe(createOwnerTokenHash(validOwnerToken));
    expect(persistedToken.lastUsedAt).toEqual(fixedNow);

    const invalidOwnerToken = await verifyOwnerToken("tb_owner_wrong_token", {
      database,
      now: fixedNow,
    });

    expect(invalidOwnerToken).toBeNull();
  });

  it("consumes a claim code exactly once and rejects expired claim codes", async () => {
    const { database } = await createTestDatabase();
    const human = await seedHuman(database, {
      handle: "bob",
      avatarUrl: "https://example.com/bob.png",
    });

    await seedClaimCode(database, {
      code: "fresh-claim-code",
      expiresAt: new Date("2026-04-21T13:00:00.000Z"),
    });
    await seedClaimCode(database, {
      code: "expired-claim-code",
      expiresAt: new Date("2026-04-21T11:00:00.000Z"),
    });

    const { consumeClaimCode } = await import(
      "../../apps/site/src/lib/server/auth"
    );

    const consumedClaimCode = await consumeClaimCode({
      code: "fresh-claim-code",
      humanId: human.humanId,
      database,
      now: fixedNow,
    });

    expect(consumedClaimCode).toMatchObject({
      code: "fresh-claim-code",
      status: "claimed",
      claimedHumanId: human.humanId,
    });

    const reusedClaimCode = await consumeClaimCode({
      code: "fresh-claim-code",
      humanId: human.humanId,
      database,
      now: fixedNow,
    });

    expect(reusedClaimCode).toBeNull();

    const expiredClaimCode = await consumeClaimCode({
      code: "expired-claim-code",
      humanId: human.humanId,
      database,
      now: fixedNow,
    });

    expect(expiredClaimCode).toBeNull();

    const [persistedClaimCode] = await database
      .select({
        status: schema.claimCodes.status,
        claimedHumanId: schema.claimCodes.claimedHumanId,
      })
      .from(schema.claimCodes)
      .where(eq(schema.claimCodes.code, "fresh-claim-code"));

    expect(persistedClaimCode).toMatchObject({
      status: "claimed",
      claimedHumanId: human.humanId,
    });
  });

  it("interrupts a stale running burn before allowing a replacement active burn", async () => {
    const { database } = await createTestDatabase();
    const human = await seedHuman(database, {
      handle: "chloe",
      avatarUrl: "https://example.com/chloe.png",
    });

    const staleBurn = await seedBurn(database, {
      ...human,
      status: "running",
      createdAt: new Date("2026-04-21T11:40:00.000Z"),
      lastHeartbeatAt: new Date("2026-04-21T11:48:00.000Z"),
    });

    const { ensureNoActiveBurnConflict } = await import(
      "../../apps/site/src/lib/server/housekeeping"
    );

    await expect(
      ensureNoActiveBurnConflict({
        humanId: human.humanId,
        database,
        now: fixedNow,
      }),
    ).resolves.toBeUndefined();

    const [interruptedBurn] = await database
      .select({
        status: schema.burns.status,
        finishedAt: schema.burns.finishedAt,
      })
      .from(schema.burns)
      .where(eq(schema.burns.id, staleBurn.burnId));

    expect(interruptedBurn).toMatchObject({
      status: "interrupted",
      finishedAt: fixedNow,
    });

    await expect(
      seedBurn(database, {
        ...human,
        status: "running",
        createdAt: fixedNow,
        lastHeartbeatAt: fixedNow,
      }),
    ).resolves.toMatchObject({
      burnId: expect.any(String),
    });
  });

  it("interrupts a stale queued burn that never heartbeated before allowing a replacement burn", async () => {
    const { database } = await createTestDatabase();
    const human = await seedHuman(database, {
      handle: "eve",
      avatarUrl: "https://example.com/eve.png",
    });

    const staleBurn = await seedBurn(database, {
      ...human,
      status: "queued",
      createdAt: new Date("2026-04-21T11:50:00.000Z"),
      startedAt: null,
      lastHeartbeatAt: null,
    });

    const { ensureNoActiveBurnConflict } = await import(
      "../../apps/site/src/lib/server/housekeeping"
    );

    await expect(
      ensureNoActiveBurnConflict({
        humanId: human.humanId,
        database,
        now: fixedNow,
      }),
    ).resolves.toBeUndefined();

    const [interruptedBurn] = await database
      .select({
        status: schema.burns.status,
        finishedAt: schema.burns.finishedAt,
      })
      .from(schema.burns)
      .where(eq(schema.burns.id, staleBurn.burnId));

    expect(interruptedBurn).toMatchObject({
      status: "interrupted",
      finishedAt: fixedNow,
    });

    await expect(
      seedBurn(database, {
        ...human,
        status: "running",
        createdAt: fixedNow,
        lastHeartbeatAt: fixedNow,
      }),
    ).resolves.toMatchObject({
      burnId: expect.any(String),
    });
  });

  it("keeps a recently started running burn without heartbeats active", async () => {
    const { database } = await createTestDatabase();
    const human = await seedHuman(database, {
      handle: "finn",
      avatarUrl: "https://example.com/finn.png",
    });

    const freshStartedAt = new Date("2026-04-21T11:58:30.000Z");
    const freshBurn = await seedBurn(database, {
      ...human,
      status: "running",
      createdAt: new Date("2026-04-21T11:40:00.000Z"),
      startedAt: freshStartedAt,
      lastHeartbeatAt: null,
    });

    const { ensureNoActiveBurnConflict } = await import(
      "../../apps/site/src/lib/server/housekeeping"
    );

    await expect(
      ensureNoActiveBurnConflict({
        humanId: human.humanId,
        database,
        now: fixedNow,
      }),
    ).rejects.toThrow(/active burn/i);

    const [activeBurn] = await database
      .select({
        status: schema.burns.status,
        startedAt: schema.burns.startedAt,
        finishedAt: schema.burns.finishedAt,
        lastHeartbeatAt: schema.burns.lastHeartbeatAt,
      })
      .from(schema.burns)
      .where(eq(schema.burns.id, freshBurn.burnId));

    expect(activeBurn).toMatchObject({
      status: "running",
      startedAt: freshStartedAt,
      finishedAt: null,
      lastHeartbeatAt: null,
    });
  });

  it("rejects a second non-stale active burn for the same human", async () => {
    const { database } = await createTestDatabase();
    const human = await seedHuman(database, {
      handle: "dana",
      avatarUrl: "https://example.com/dana.png",
    });

    await seedBurn(database, {
      ...human,
      status: "running",
      createdAt: new Date("2026-04-21T11:55:00.000Z"),
      lastHeartbeatAt: new Date("2026-04-21T11:59:00.000Z"),
    });

    const { ensureNoActiveBurnConflict } = await import(
      "../../apps/site/src/lib/server/housekeeping"
    );

    await expect(
      ensureNoActiveBurnConflict({
        humanId: human.humanId,
        database,
        now: fixedNow,
      }),
    ).rejects.toThrow(/active burn/i);

    const [activeBurn] = await database
      .select({
        status: schema.burns.status,
      })
      .from(schema.burns)
      .where(eq(schema.burns.humanId, human.humanId));

    expect(activeBurn.status).toBe("running");
  });
});
