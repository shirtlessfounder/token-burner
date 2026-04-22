import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const readRepoFile = async (relativePath: string) =>
  readFile(path.join(repoRoot, relativePath), "utf8");

describe("database schema foundation", () => {
  it("defines the six core tables and required burn columns in the Drizzle schema", async () => {
    const schemaModule = await import("../../apps/site/src/lib/db/schema");

    expect(schemaModule).toMatchObject({
      humans: expect.anything(),
      agentInstallations: expect.anything(),
      claimCodes: expect.anything(),
      ownerTokens: expect.anything(),
      burns: expect.anything(),
      burnEvents: expect.anything(),
    });

    expect(schemaModule.humans.publicHandle).toBeDefined();
    expect(schemaModule.humans.avatarUrl).toBeDefined();
    expect(schemaModule.agentInstallations.agentLabel).toBeDefined();
    expect(schemaModule.claimCodes.code).toBeDefined();
    expect(schemaModule.ownerTokens.tokenHash).toBeDefined();
    expect(schemaModule.burns.provider).toBeDefined();
    expect(schemaModule.burns.model).toBeDefined();
    expect(schemaModule.burns.status).toBeDefined();
    expect(schemaModule.burns.requestedBilledTokenTarget).toBeDefined();
    expect(schemaModule.burns.billedTokensConsumed).toBeDefined();
    expect(schemaModule.burns.lastHeartbeatAt).toBeDefined();
    expect(schemaModule.burns.startedAt).toBeDefined();
    expect(schemaModule.burns.finishedAt).toBeDefined();
    expect(schemaModule.burnEvents.eventType).toBeDefined();
    expect(schemaModule.burnEvents.eventPayload).toBeDefined();
  });

  it("keeps the site database client server-only and env-backed", async () => {
    const clientSource = await readRepoFile("apps/site/src/lib/db/client.ts");

    expect(clientSource).toContain('import "server-only"');
    expect(clientSource).toMatch(/DATABASE_URL/);
    expect(clientSource).toMatch(/DATABASE_URL_MIGRATIONS/);
    expect(clientSource).toMatch(/drizzle-orm\/node-postgres/);
    expect(clientSource).toMatch(/from "pg"/);
  });

  it("creates the required tables, burn columns, and uniqueness indexes in SQL", async () => {
    const migrationSql = await readRepoFile("drizzle/0001_initial.sql");

    for (const tableName of [
      "humans",
      "agent_installations",
      "claim_codes",
      "owner_tokens",
      "burns",
      "burn_events",
    ]) {
      expect(migrationSql).toMatch(
        new RegExp(`create table\\s+\"?${tableName}\"?`, "i"),
      );
    }

    expect(migrationSql).toMatch(
      /requested_billed_token_target bigint not null check \(requested_billed_token_target > 0\)/i,
    );
    expect(migrationSql).toMatch(
      /billed_tokens_consumed bigint not null default 0/i,
    );
    expect(migrationSql).toMatch(/provider text not null/i);
    expect(migrationSql).toMatch(/model text not null/i);
    expect(migrationSql).toMatch(/status text not null/i);
    expect(migrationSql).toMatch(/last_heartbeat_at timestamptz null/i);
    expect(migrationSql).toMatch(
      /create unique index humans_public_handle_idx\s+on humans \(lower\(public_handle\)\)/i,
    );
    expect(migrationSql).toMatch(
      /create unique index burns_one_active_per_human_idx\s+on burns \(human_id\)\s+where status in \('queued', 'running', 'stopping'\)/i,
    );
  });
});
