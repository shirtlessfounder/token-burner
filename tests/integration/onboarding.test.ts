import { randomUUID } from "node:crypto";
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
const fixedNow = new Date("2026-04-22T12:00:00.000Z");
const ownerTokenHashSecret =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

  const migrationSql = await readFile(migrationPath, "utf8");
  memoryDatabase.public.none(
    migrationSql.replace(/create extension if not exists "pgcrypto";\n\n/i, ""),
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

describe("createClaimCode", () => {
  it("inserts an available claim code with a TTL", async () => {
    const { database } = await createTestDatabase();
    const { createClaimCode } = await import(
      "../../apps/site/src/lib/server/onboarding"
    );

    const result = await createClaimCode({ database, now: fixedNow });

    expect(result.code).toMatch(/^[A-Z0-9]{8}$/);
    expect(result.expiresAt.getTime() - fixedNow.getTime()).toBe(15 * 60 * 1000);

    const [row] = await database
      .select()
      .from(schema.claimCodes)
      .where(eq(schema.claimCodes.code, result.code));
    expect(row).toMatchObject({
      code: result.code,
      status: "available",
      claimedHumanId: null,
    });
  });
});

describe("registerHumanFromClaim", () => {
  it("creates human + installation + owner token and consumes the claim code", async () => {
    const { database } = await createTestDatabase();
    const { createClaimCode, registerHumanFromClaim } = await import(
      "../../apps/site/src/lib/server/onboarding"
    );

    const { code } = await createClaimCode({ database, now: fixedNow });

    const result = await registerHumanFromClaim({
      claimCode: code,
      publicHandle: "alembic",
      avatar: "🔥",
      agentLabel: "claude-code@laptop",
      database,
      now: fixedNow,
    });

    expect(result.handle).toBe("alembic");
    expect(result.avatar).toBe("🔥");

    const { parseRegisterResponse } = await import("@token-burner/shared");
    expect(() => parseRegisterResponse(result)).not.toThrow();

    const [human] = await database
      .select()
      .from(schema.humans)
      .where(eq(schema.humans.id, result.humanId));
    expect(human).toMatchObject({ publicHandle: "alembic", avatarUrl: "🔥" });

    const [claim] = await database
      .select()
      .from(schema.claimCodes)
      .where(eq(schema.claimCodes.code, code));
    expect(claim).toMatchObject({
      status: "claimed",
      claimedHumanId: result.humanId,
    });
  });

  it("rejects an invalid claim code", async () => {
    const { database } = await createTestDatabase();
    const { ClaimCodeInvalidError, registerHumanFromClaim } = await import(
      "../../apps/site/src/lib/server/onboarding"
    );

    await expect(
      registerHumanFromClaim({
        claimCode: "NOTREAL1",
        publicHandle: "x",
        avatar: "x",
        agentLabel: "x",
        database,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(ClaimCodeInvalidError);
  });

  it("rejects an expired claim code", async () => {
    const { database } = await createTestDatabase();
    const { ClaimCodeInvalidError, createClaimCode, registerHumanFromClaim } =
      await import("../../apps/site/src/lib/server/onboarding");

    const { code } = await createClaimCode({ database, now: fixedNow });
    const later = new Date(fixedNow.getTime() + 16 * 60 * 1000);

    await expect(
      registerHumanFromClaim({
        claimCode: code,
        publicHandle: "x",
        avatar: "x",
        agentLabel: "x",
        database,
        now: later,
      }),
    ).rejects.toBeInstanceOf(ClaimCodeInvalidError);
  });
});

describe("linkAgentToHuman", () => {
  it("creates a second installation on the same human", async () => {
    const { database } = await createTestDatabase();
    const { createClaimCode, registerHumanFromClaim, linkAgentToHuman } =
      await import("../../apps/site/src/lib/server/onboarding");

    const { code } = await createClaimCode({ database, now: fixedNow });
    const registered = await registerHumanFromClaim({
      claimCode: code,
      publicHandle: "alembic",
      avatar: "🔥",
      agentLabel: "claude-code@laptop",
      database,
      now: fixedNow,
    });

    const linked = await linkAgentToHuman({
      ownerToken: registered.ownerToken,
      agentLabel: "codex@desktop",
      database,
      now: fixedNow,
    });

    expect(linked.humanId).toBe(registered.humanId);
    expect(linked.handle).toBe("alembic");
    expect(linked.agentInstallationId).not.toBe(registered.agentInstallationId);

    const installations = await database
      .select()
      .from(schema.agentInstallations)
      .where(eq(schema.agentInstallations.humanId, registered.humanId));
    expect(installations).toHaveLength(2);
  });

  it("rejects an unknown owner token", async () => {
    const { database } = await createTestDatabase();
    const { OwnerTokenInvalidError, linkAgentToHuman } = await import(
      "../../apps/site/src/lib/server/onboarding"
    );

    await expect(
      linkAgentToHuman({
        ownerToken: "tb_owner_unknown",
        agentLabel: "x",
        database,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(OwnerTokenInvalidError);
  });

  it("rejects a revoked owner token", async () => {
    const { database } = await createTestDatabase();
    const { OwnerTokenInvalidError, createClaimCode, registerHumanFromClaim, linkAgentToHuman } =
      await import("../../apps/site/src/lib/server/onboarding");

    const { code } = await createClaimCode({ database, now: fixedNow });
    const registered = await registerHumanFromClaim({
      claimCode: code,
      publicHandle: "alembic",
      avatar: "🔥",
      agentLabel: "claude-code@laptop",
      database,
      now: fixedNow,
    });

    await database
      .update(schema.ownerTokens)
      .set({ revokedAt: fixedNow })
      .where(eq(schema.ownerTokens.humanId, registered.humanId));

    await expect(
      linkAgentToHuman({
        ownerToken: registered.ownerToken,
        agentLabel: "codex@desktop",
        database,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(OwnerTokenInvalidError);
  });
});
