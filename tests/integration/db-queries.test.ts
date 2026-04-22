import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { DataType, newDb } from "pg-mem";
import { afterEach, describe, expect, it } from "vitest";

import {
  getLiveBurnFeed,
  getProviderAllTimeLeaderboard,
  getProviderDailyLeaderboard,
  getProviderWeeklyLeaderboard,
  getPublicBurnById,
  getPublicProfileByHandle,
} from "../../apps/site/src/lib/db/queries";
import * as schema from "../../apps/site/src/lib/db/schema";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const migrationsDirectory = path.join(repoRoot, "drizzle");

const readAllMigrationsSql = async (): Promise<string> => {
  const entries = await readdir(migrationsDirectory);
  const files = entries.filter((entry) => entry.endsWith(".sql")).sort();
  const contents = await Promise.all(
    files.map((file) => readFile(path.join(migrationsDirectory, file), "utf8")),
  );
  return contents.join("\n");
};
const fixedNow = new Date("2026-04-21T12:00:00.000Z");

const activeStatuses = ["queued", "running", "stopping"] as const;

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

  const migrationSql = await readAllMigrationsSql();
  memoryDatabase.public.none(
    migrationSql
      .replace(/--[^\n]*/g, "")
      .replace(/create extension if not exists "pgcrypto";\n\n?/gi, "")
      .replace(/^alter table[^;]+enable row level security\s*;/gim, "")
      .replace(/^create policy[^;]+;/gim, "")
      .replace(/^revoke[^;]+;/gim, "")
      .replace(/^alter publication[^;]+;/gim, ""),
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

const seedBurn = async (
  database: TestDatabase,
  {
    burnId = randomUUID(),
    humanId,
    installationId,
    provider,
    model = provider === "openai" ? "gpt-5.4" : "claude-opus-4.1",
    status,
    billedTokensConsumed,
    requestedBilledTokenTarget = billedTokensConsumed + 100,
    createdAt,
    startedAt = createdAt,
    finishedAt = activeStatuses.includes(status)
      ? null
      : new Date(createdAt.getTime() + 60_000),
    lastHeartbeatAt = activeStatuses.includes(status) ? fixedNow : createdAt,
  }: {
    burnId?: string;
    humanId: string;
    installationId: string;
    provider: "openai" | "anthropic";
    model?: string;
    status: (typeof schema.burns.$inferInsert)["status"];
    billedTokensConsumed: number;
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

afterEach(async () => {
  while (openPools.length > 0) {
    const pool = openPools.pop();

    if (pool) {
      await pool.end();
    }
  }
});

describe("database query layer", () => {
  it("keeps provider leaderboards split and applies daily and weekly time windows", async () => {
    const { database } = await createTestDatabase();

    const alice = await seedHuman(database, {
      handle: "Alice",
      avatarUrl: "https://example.com/alice.png",
    });
    const bob = await seedHuman(database, {
      handle: "Bob",
      avatarUrl: "https://example.com/bob.png",
    });
    const chloe = await seedHuman(database, {
      handle: "Chloe",
      avatarUrl: "https://example.com/chloe.png",
    });

    await seedBurn(database, {
      ...alice,
      provider: "openai",
      status: "completed",
      billedTokensConsumed: 600,
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
    });
    await seedBurn(database, {
      ...bob,
      provider: "openai",
      status: "interrupted",
      billedTokensConsumed: 800,
      createdAt: new Date("2026-04-18T08:00:00.000Z"),
    });
    await seedBurn(database, {
      ...chloe,
      provider: "openai",
      status: "failed",
      billedTokensConsumed: 1_200,
      createdAt: new Date("2026-04-10T08:00:00.000Z"),
    });
    await seedBurn(database, {
      ...chloe,
      provider: "anthropic",
      status: "completed",
      billedTokensConsumed: 900,
      createdAt: new Date("2026-04-21T09:00:00.000Z"),
    });
    await seedBurn(database, {
      ...alice,
      provider: "anthropic",
      status: "completed",
      billedTokensConsumed: 500,
      createdAt: new Date("2026-04-19T09:00:00.000Z"),
    });
    await seedBurn(database, {
      ...bob,
      provider: "anthropic",
      status: "running",
      billedTokensConsumed: 999,
      createdAt: new Date("2026-04-21T11:00:00.000Z"),
    });

    const daily = await getProviderDailyLeaderboard({
      database,
      now: fixedNow,
    });
    const weekly = await getProviderWeeklyLeaderboard({
      database,
      now: fixedNow,
    });
    const allTime = await getProviderAllTimeLeaderboard({
      database,
    });

    expect(daily.entries.openai).toMatchObject([
      {
        humanId: alice.humanId,
        handle: "Alice",
        provider: "openai",
        totalBilledTokens: 600,
        rank: 1,
      },
    ]);
    expect(daily.entries.anthropic).toMatchObject([
      {
        humanId: chloe.humanId,
        handle: "Chloe",
        provider: "anthropic",
        totalBilledTokens: 900,
        rank: 1,
      },
    ]);
    expect(daily.totals).toEqual({ openai: 600, anthropic: 900 });

    expect(weekly.entries.openai.map((entry) => entry.handle)).toEqual([
      "Bob",
      "Alice",
    ]);
    expect(weekly.entries.openai.map((entry) => entry.totalBilledTokens)).toEqual(
      [800, 600],
    );
    expect(weekly.entries.anthropic.map((entry) => entry.handle)).toEqual([
      "Chloe",
      "Alice",
    ]);
    expect(
      weekly.entries.anthropic.map((entry) => entry.totalBilledTokens),
    ).toEqual([900, 500]);
    expect(weekly.totals).toEqual({ openai: 1_400, anthropic: 1_400 });

    expect(allTime.entries.openai.map((entry) => entry.handle)).toEqual([
      "Chloe",
      "Bob",
      "Alice",
    ]);
    expect(
      allTime.entries.openai.map((entry) => entry.totalBilledTokens),
    ).toEqual([1_200, 800, 600]);
    expect(allTime.entries.anthropic.map((entry) => entry.handle)).toEqual([
      "Chloe",
      "Alice",
    ]);
    expect(
      allTime.entries.anthropic.map((entry) => entry.totalBilledTokens),
    ).toEqual([900, 500]);
    expect(allTime.totals).toEqual({ openai: 2_600, anthropic: 1_400 });

    expect(daily.entries.openai[0]).not.toHaveProperty("burnId");
    expect(daily.entries.openai[0]).not.toHaveProperty("billedTokensConsumed");
  });

  it("aggregates same-human burns into one ranked leaderboard row per provider", async () => {
    const { database } = await createTestDatabase();

    const alice = await seedHuman(database, {
      handle: "Alice",
      avatarUrl: "https://example.com/alice.png",
    });
    const bob = await seedHuman(database, {
      handle: "Bob",
      avatarUrl: "https://example.com/bob.png",
    });

    await seedBurn(database, {
      ...alice,
      provider: "openai",
      status: "completed",
      billedTokensConsumed: 400,
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
    });
    await seedBurn(database, {
      ...alice,
      provider: "openai",
      status: "completed",
      billedTokensConsumed: 350,
      createdAt: new Date("2026-04-21T08:00:00.000Z"),
    });
    await seedBurn(database, {
      ...alice,
      provider: "openai",
      status: "interrupted",
      billedTokensConsumed: 300,
      createdAt: new Date("2026-04-18T08:00:00.000Z"),
    });
    await seedBurn(database, {
      ...bob,
      provider: "openai",
      status: "completed",
      billedTokensConsumed: 700,
      createdAt: new Date("2026-04-21T09:00:00.000Z"),
    });
    await seedBurn(database, {
      ...bob,
      provider: "anthropic",
      status: "completed",
      billedTokensConsumed: 950,
      createdAt: new Date("2026-04-21T09:30:00.000Z"),
    });

    const daily = await getProviderDailyLeaderboard({
      database,
      now: fixedNow,
    });
    const weekly = await getProviderWeeklyLeaderboard({
      database,
      now: fixedNow,
    });
    const allTime = await getProviderAllTimeLeaderboard({
      database,
    });

    expect(daily.entries.openai).toMatchObject([
      {
        humanId: alice.humanId,
        handle: "Alice",
        avatarUrl: "https://example.com/alice.png",
        provider: "openai",
        totalBilledTokens: 750,
        rank: 1,
      },
      {
        humanId: bob.humanId,
        handle: "Bob",
        avatarUrl: "https://example.com/bob.png",
        provider: "openai",
        totalBilledTokens: 700,
        rank: 2,
      },
    ]);
    expect(daily.entries.openai).toHaveLength(2);
    expect(daily.entries.openai[0]).not.toHaveProperty("burnId");
    expect(daily.entries.openai[0]).not.toHaveProperty("billedTokensConsumed");
    expect(daily.totals).toEqual({ openai: 1_450, anthropic: 950 });

    expect(weekly.entries.openai.map((entry) => entry.totalBilledTokens)).toEqual(
      [1_050, 700],
    );
    expect(weekly.entries.openai.map((entry) => entry.rank)).toEqual([1, 2]);
    expect(weekly.totals).toEqual({ openai: 1_750, anthropic: 950 });

    expect(
      allTime.entries.openai.map((entry) => entry.totalBilledTokens),
    ).toEqual([1_050, 700]);
    expect(allTime.entries.anthropic).toMatchObject([
      {
        humanId: bob.humanId,
        handle: "Bob",
        provider: "anthropic",
        totalBilledTokens: 950,
        rank: 1,
      },
    ]);
    expect(allTime.totals).toEqual({ openai: 1_750, anthropic: 950 });
  });

  it("returns only active burns in the live feed", async () => {
    const { database } = await createTestDatabase();

    const alice = await seedHuman(database, {
      handle: "Alice",
      avatarUrl: "https://example.com/alice.png",
    });
    const bob = await seedHuman(database, {
      handle: "Bob",
      avatarUrl: "https://example.com/bob.png",
    });

    const runningBurn = await seedBurn(database, {
      ...alice,
      provider: "openai",
      status: "running",
      billedTokensConsumed: 320,
      requestedBilledTokenTarget: 1_000,
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      lastHeartbeatAt: new Date("2026-04-21T11:58:00.000Z"),
    });
    await seedBurn(database, {
      ...alice,
      provider: "openai",
      status: "completed",
      billedTokensConsumed: 700,
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
    });
    const queuedBurn = await seedBurn(database, {
      ...bob,
      provider: "anthropic",
      status: "queued",
      billedTokensConsumed: 0,
      requestedBilledTokenTarget: 2_000,
      createdAt: new Date("2026-04-21T11:00:00.000Z"),
      startedAt: null,
      lastHeartbeatAt: new Date("2026-04-21T11:59:00.000Z"),
    });

    const liveFeed = await getLiveBurnFeed({ database });

    expect(liveFeed.map((entry) => entry.burnId)).toEqual([
      queuedBurn.burnId,
      runningBurn.burnId,
    ]);
    expect(liveFeed.every((entry) => activeStatuses.includes(entry.status))).toBe(
      true,
    );
    expect(liveFeed[0]).toMatchObject({
      handle: "Bob",
      provider: "anthropic",
      model: "claude-opus-4.1",
      requestedBilledTokenTarget: 2_000,
      billedTokensConsumed: 0,
      status: "queued",
    });
    expect(liveFeed[0]).not.toHaveProperty("eventPayload");
  });

  it("looks up public profiles case-insensitively and returns provider totals plus recent burns", async () => {
    const { database } = await createTestDatabase();

    const alice = await seedHuman(database, {
      handle: "ALICE",
      avatarUrl: "https://example.com/alice.png",
    });

    const newestBurn = await seedBurn(database, {
      ...alice,
      provider: "anthropic",
      status: "running",
      billedTokensConsumed: 350,
      requestedBilledTokenTarget: 1_200,
      createdAt: new Date("2026-04-21T11:00:00.000Z"),
      lastHeartbeatAt: new Date("2026-04-21T11:59:00.000Z"),
    });
    await seedBurn(database, {
      ...alice,
      provider: "openai",
      status: "completed",
      billedTokensConsumed: 800,
      createdAt: new Date("2026-04-20T11:00:00.000Z"),
    });
    await seedBurn(database, {
      ...alice,
      provider: "openai",
      status: "failed",
      billedTokensConsumed: 120,
      createdAt: new Date("2026-04-18T11:00:00.000Z"),
    });

    const profile = await getPublicProfileByHandle("alice", { database });

    expect(profile).toMatchObject({
      handle: "ALICE",
      avatarUrl: "https://example.com/alice.png",
      providerTotals: {
        openai: 920,
        anthropic: 350,
      },
    });
    expect(profile?.recentBurns[0]).toMatchObject({
      burnId: newestBurn.burnId,
      provider: "anthropic",
      status: "running",
      billedTokensConsumed: 350,
    });
    expect(profile?.recentBurns).toHaveLength(3);

    await expect(
      getPublicProfileByHandle("missing-handle", { database }),
    ).resolves.toBeNull();
  });

  it("returns public burn records by id and null for unknown ids", async () => {
    const { database } = await createTestDatabase();

    const alice = await seedHuman(database, {
      handle: "Alice",
      avatarUrl: "https://example.com/alice.png",
    });

    const burn = await seedBurn(database, {
      ...alice,
      provider: "openai",
      model: "gpt-5.4",
      status: "completed",
      billedTokensConsumed: 1_024,
      requestedBilledTokenTarget: 1_500,
      createdAt: new Date("2026-04-21T07:00:00.000Z"),
      finishedAt: new Date("2026-04-21T07:15:00.000Z"),
    });

    const publicBurn = await getPublicBurnById(burn.burnId, { database });

    expect(publicBurn).toMatchObject({
      burnId: burn.burnId,
      handle: "Alice",
      avatarUrl: "https://example.com/alice.png",
      provider: "openai",
      model: "gpt-5.4",
      requestedBilledTokenTarget: 1_500,
      billedTokensConsumed: 1_024,
      status: "completed",
    });

    await expect(
      getPublicBurnById("00000000-0000-0000-0000-000000000000", { database }),
    ).resolves.toBeNull();
  });

  it("returns null for malformed public burn ids", async () => {
    const { database } = await createTestDatabase();

    await expect(
      getPublicBurnById("not-a-uuid", { database }),
    ).resolves.toBeNull();
  });
});
