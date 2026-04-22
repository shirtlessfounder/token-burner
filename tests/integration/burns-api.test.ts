import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { DataType, newDb } from "pg-mem";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as schema from "../../apps/site/src/lib/db/schema";

vi.mock("server-only", () => ({}));

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const migrationsDirectory = path.join(repoRoot, "drizzle");
const fixedNow = new Date("2026-04-22T12:00:00.000Z");
const ownerTokenHashSecret =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const readAllMigrationsSql = async (): Promise<string> => {
  const entries = await readdir(migrationsDirectory);
  const files = entries.filter((entry) => entry.endsWith(".sql")).sort();
  const contents = await Promise.all(
    files.map((file) => readFile(path.join(migrationsDirectory, file), "utf8")),
  );
  return contents.join("\n");
};

type TestDatabase = ReturnType<typeof drizzle<typeof schema>>;

type TestContext = {
  database: TestDatabase;
  pool: { end: () => Promise<void> };
};

const openPools: Array<{ end: () => Promise<void> }> = [];

const createTestDatabase = async (): Promise<TestContext> => {
  const memoryDatabase = newDb({ autoCreateForeignKeyIndices: true });
  memoryDatabase.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    implementation: randomUUID,
    impure: true,
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
      adaptResults: (
        query: unknown,
        results: {
          rows: Array<Record<string, unknown>>;
          fields: Array<{ name: string }>;
        },
      ) => unknown;
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

afterEach(async () => {
  while (openPools.length > 0) {
    const pool = openPools.pop();
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
});

beforeEach(() => {
  process.env.OWNER_TOKEN_HASH_SECRET = ownerTokenHashSecret;
});

const seedRegisteredHuman = async (database: TestDatabase) => {
  const { createClaimCode, registerHumanFromClaim } = await import(
    "../../apps/site/src/lib/server/onboarding"
  );
  const { code } = await createClaimCode({ database, now: fixedNow });
  return registerHumanFromClaim({
    claimCode: code,
    publicHandle: `human-${randomUUID().slice(0, 6)}`,
    avatar: "X",
    agentLabel: "first",
    database,
    now: fixedNow,
  });
};

describe("startBurn", () => {
  it("creates a running burn row with the fixed provider model and a session token", async () => {
    const { database } = await createTestDatabase();
    const registered = await seedRegisteredHuman(database);
    const { startBurn } = await import(
      "../../apps/site/src/lib/server/burns"
    );

    const result = await startBurn({
      ownerToken: registered.ownerToken,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      targetTokens: 5_000,
      database,
      now: fixedNow,
    });

    expect(result.status).toBe("running");
    expect(result.burnId).toMatch(/[0-9a-f-]{36}/);
    expect(result.burnSessionToken).toMatch(/^tb_burn_[0-9a-f]+$/);

    const [row] = await database
      .select()
      .from(schema.burns)
      .where(eq(schema.burns.id, result.burnId));
    expect(row).toMatchObject({
      humanId: registered.humanId,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      model: "claude-opus-4-7",
      requestedBilledTokenTarget: 5_000,
      billedTokensConsumed: 0,
      status: "running",
    });
    expect(row.burnSessionTokenHash).not.toBeNull();
  });

  it("rejects an invalid owner token", async () => {
    const { database } = await createTestDatabase();
    const { OwnerTokenInvalidError, startBurn } = await import(
      "../../apps/site/src/lib/server/burns"
    );

    await expect(
      startBurn({
        ownerToken: "tb_owner_unknown",
        agentInstallationId: randomUUID(),
        provider: "anthropic",
        targetTokens: 100,
        database,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(OwnerTokenInvalidError);
  });

  it("refuses to start a second burn while one is active", async () => {
    const { database } = await createTestDatabase();
    const registered = await seedRegisteredHuman(database);
    const { startBurn } = await import(
      "../../apps/site/src/lib/server/burns"
    );
    const { ActiveBurnConflictError } = await import(
      "../../apps/site/src/lib/server/housekeeping"
    );

    await startBurn({
      ownerToken: registered.ownerToken,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      targetTokens: 5_000,
      database,
      now: fixedNow,
    });

    await expect(
      startBurn({
        ownerToken: registered.ownerToken,
        agentInstallationId: registered.agentInstallationId,
        provider: "anthropic",
        targetTokens: 1_000,
        database,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(ActiveBurnConflictError);
  });
});

describe("recordHeartbeat", () => {
  it("updates billed_tokens_consumed and refreshes last_heartbeat_at", async () => {
    const { database } = await createTestDatabase();
    const registered = await seedRegisteredHuman(database);
    const { recordHeartbeat, startBurn } = await import(
      "../../apps/site/src/lib/server/burns"
    );

    const started = await startBurn({
      ownerToken: registered.ownerToken,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      targetTokens: 10_000,
      database,
      now: fixedNow,
    });

    const later = new Date(fixedNow.getTime() + 30_000);
    const result = await recordHeartbeat({
      burnId: started.burnId,
      burnSessionToken: started.burnSessionToken,
      billedTokensConsumed: 1_234,
      database,
      now: later,
    });

    expect(result.billedTokensConsumed).toBe(1_234);
    expect(result.status).toBe("running");

    const [row] = await database
      .select()
      .from(schema.burns)
      .where(eq(schema.burns.id, started.burnId));
    expect(row.billedTokensConsumed).toBe(1_234);
    expect(row.lastHeartbeatAt?.toISOString()).toBe(later.toISOString());
  });

  it("caps billed tokens at the requested target", async () => {
    const { database } = await createTestDatabase();
    const registered = await seedRegisteredHuman(database);
    const { recordHeartbeat, startBurn } = await import(
      "../../apps/site/src/lib/server/burns"
    );

    const started = await startBurn({
      ownerToken: registered.ownerToken,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      targetTokens: 1_000,
      database,
      now: fixedNow,
    });

    const result = await recordHeartbeat({
      burnId: started.burnId,
      burnSessionToken: started.burnSessionToken,
      billedTokensConsumed: 99_999,
      database,
      now: fixedNow,
    });

    expect(result.billedTokensConsumed).toBe(1_000);
  });

  it("rejects an unknown session token", async () => {
    const { database } = await createTestDatabase();
    const registered = await seedRegisteredHuman(database);
    const { BurnSessionInvalidError, recordHeartbeat, startBurn } =
      await import("../../apps/site/src/lib/server/burns");

    const started = await startBurn({
      ownerToken: registered.ownerToken,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      targetTokens: 1_000,
      database,
      now: fixedNow,
    });

    await expect(
      recordHeartbeat({
        burnId: started.burnId,
        burnSessionToken: "tb_burn_bogus",
        billedTokensConsumed: 1,
        database,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(BurnSessionInvalidError);
  });
});

describe("recordBurnEvent", () => {
  it("inserts a burn_events row and optionally updates billed tokens", async () => {
    const { database } = await createTestDatabase();
    const registered = await seedRegisteredHuman(database);
    const { recordBurnEvent, startBurn } = await import(
      "../../apps/site/src/lib/server/burns"
    );

    const started = await startBurn({
      ownerToken: registered.ownerToken,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      targetTokens: 10_000,
      database,
      now: fixedNow,
    });

    await recordBurnEvent({
      burnId: started.burnId,
      burnSessionToken: started.burnSessionToken,
      eventType: "step",
      eventPayload: { inputTokens: 200, outputTokens: 300 },
      billedTokensConsumed: 500,
      database,
      now: fixedNow,
    });

    const events = await database
      .select()
      .from(schema.burnEvents)
      .where(eq(schema.burnEvents.burnId, started.burnId));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "step",
      eventPayload: { inputTokens: 200, outputTokens: 300 },
    });

    const [burn] = await database
      .select()
      .from(schema.burns)
      .where(eq(schema.burns.id, started.burnId));
    expect(burn.billedTokensConsumed).toBe(500);
  });
});

describe("finishBurn", () => {
  it("marks the burn as completed and clears the session token hash", async () => {
    const { database } = await createTestDatabase();
    const registered = await seedRegisteredHuman(database);
    const { finishBurn, startBurn } = await import(
      "../../apps/site/src/lib/server/burns"
    );

    const started = await startBurn({
      ownerToken: registered.ownerToken,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      targetTokens: 10_000,
      database,
      now: fixedNow,
    });

    const finishedAt = new Date(fixedNow.getTime() + 60_000);
    const result = await finishBurn({
      burnId: started.burnId,
      burnSessionToken: started.burnSessionToken,
      status: "completed",
      billedTokensConsumed: 9_950,
      database,
      now: finishedAt,
    });

    expect(result.status).toBe("completed");

    const [row] = await database
      .select()
      .from(schema.burns)
      .where(eq(schema.burns.id, started.burnId));
    expect(row.status).toBe("completed");
    expect(row.billedTokensConsumed).toBe(9_950);
    expect(row.finishedAt?.toISOString()).toBe(finishedAt.toISOString());
    expect(row.burnSessionTokenHash).toBeNull();
  });

  it("refuses a second finish with the same session token", async () => {
    const { database } = await createTestDatabase();
    const registered = await seedRegisteredHuman(database);
    const { BurnSessionInvalidError, finishBurn, startBurn } = await import(
      "../../apps/site/src/lib/server/burns"
    );

    const started = await startBurn({
      ownerToken: registered.ownerToken,
      agentInstallationId: registered.agentInstallationId,
      provider: "anthropic",
      targetTokens: 10_000,
      database,
      now: fixedNow,
    });

    await finishBurn({
      burnId: started.burnId,
      burnSessionToken: started.burnSessionToken,
      status: "completed",
      billedTokensConsumed: 100,
      database,
      now: fixedNow,
    });

    await expect(
      finishBurn({
        burnId: started.burnId,
        burnSessionToken: started.burnSessionToken,
        status: "completed",
        billedTokensConsumed: 100,
        database,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(BurnSessionInvalidError);
  });
});
