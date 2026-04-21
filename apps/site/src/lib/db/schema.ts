import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { burnStatusValues, providerValues } from "@token-burner/shared";

const providerValuesSql = sql.raw(
  providerValues.map((provider) => `'${provider}'`).join(", "),
);

const activeBurnStatuses = burnStatusValues.filter(
  (status): status is (typeof burnStatusValues)[number] =>
    status === "queued" || status === "running" || status === "stopping",
);

const activeBurnStatusesSql = sql.raw(
  activeBurnStatuses.map((status) => `'${status}'`).join(", "),
);

const burnStatusValuesSql = sql.raw(
  burnStatusValues.map((status) => `'${status}'`).join(", "),
);

export const humans = pgTable(
  "humans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicHandle: text("public_handle").notNull(),
    avatarUrl: text("avatar_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("humans_public_handle_idx").using(
      "btree",
      sql`lower(${table.publicHandle})`,
    ),
  ],
);

export const agentInstallations = pgTable("agent_installations", {
  id: uuid("id").defaultRandom().primaryKey(),
  humanId: uuid("human_id")
    .notNull()
    .references(() => humans.id, { onDelete: "cascade" }),
  agentLabel: text("agent_label").notNull(),
  localMachineLabel: text("local_machine_label"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const claimCodes = pgTable("claim_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("available"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  claimedHumanId: uuid("claimed_human_id").references(() => humans.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ownerTokens = pgTable("owner_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  humanId: uuid("human_id")
    .notNull()
    .references(() => humans.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const burns = pgTable(
  "burns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    humanId: uuid("human_id")
      .notNull()
      .references(() => humans.id, { onDelete: "cascade" }),
    agentInstallationId: uuid("agent_installation_id")
      .notNull()
      .references(() => agentInstallations.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: providerValues }).notNull(),
    model: text("model").notNull(),
    presetId: text("preset_id"),
    requestedBilledTokenTarget: bigint("requested_billed_token_target", {
      mode: "number",
    }).notNull(),
    billedTokensConsumed: bigint("billed_tokens_consumed", {
      mode: "number",
    })
      .notNull()
      .default(0),
    status: text("status", { enum: burnStatusValues }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "burns_requested_billed_token_target_check",
      sql`${table.requestedBilledTokenTarget} > 0`,
    ),
    check(
      "burns_billed_tokens_consumed_check",
      sql`${table.billedTokensConsumed} >= 0`,
    ),
    check(
      "burns_provider_check",
      sql`${table.provider} in (${providerValuesSql})`,
    ),
    check(
      "burns_status_check",
      sql`${table.status} in (${burnStatusValuesSql})`,
    ),
    uniqueIndex("burns_one_active_per_human_idx")
      .on(table.humanId)
      .where(sql`${table.status} in (${activeBurnStatusesSql})`),
  ],
);

export const burnEvents = pgTable("burn_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  burnId: uuid("burn_id")
    .notNull()
    .references(() => burns.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  eventPayload: jsonb("event_payload")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
