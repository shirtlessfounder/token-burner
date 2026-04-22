import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  providerValues,
  terminalBurnStatusValues,
  type BurnStatus,
  type ProviderId,
} from "@token-burner/shared";

import * as schema from "./schema";

const { burns, humans } = schema;

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const weekInMilliseconds = 7 * dayInMilliseconds;
const activeBurnStatuses = ["queued", "running", "stopping"] as const;

type TokenBurnerDatabase = NodePgDatabase<typeof schema>;

type QueryOptions = {
  database?: TokenBurnerDatabase;
};

type TimedQueryOptions = QueryOptions & {
  now?: Date;
  limit?: number;
};

type RecentBurnOptions = QueryOptions & {
  recentBurnLimit?: number;
};

type LeaderboardRow = {
  burnId: string;
  humanId: string;
  handle: string;
  avatarUrl: string;
  provider: ProviderId;
  model: string;
  requestedBilledTokenTarget: number;
  billedTokensConsumed: number;
  status: BurnStatus;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

type BurnSummaryRow = {
  burnId: string;
  provider: ProviderId;
  model: string;
  requestedBilledTokenTarget: number;
  billedTokensConsumed: number;
  status: BurnStatus;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type LeaderboardEntry = LeaderboardRow & {
  rank: number;
};

export type ProviderSplitLeaderboard = Record<ProviderId, LeaderboardEntry[]>;

export type LiveBurnFeedEntry = LeaderboardRow & {
  lastHeartbeatAt: Date | null;
};

export type PublicProfileBurn = BurnSummaryRow;

export type PublicProfile = {
  humanId: string;
  handle: string;
  avatarUrl: string;
  providerTotals: Record<ProviderId, number>;
  recentBurns: PublicProfileBurn[];
};

export type PublicBurn = BurnSummaryRow & {
  burnId: string;
  humanId: string;
  handle: string;
  avatarUrl: string;
};

const createEmptyProviderRecord = <Value>(factory: () => Value): Record<
  ProviderId,
  Value
> => ({
  openai: factory(),
  anthropic: factory(),
});

const normalizeNumericValue = (value: number | string | null | undefined) =>
  value === null || value === undefined ? 0 : Number(value);

const mapBurnSummary = (row: BurnSummaryRow): PublicProfileBurn => ({
  burnId: row.burnId,
  provider: row.provider,
  model: row.model,
  requestedBilledTokenTarget: row.requestedBilledTokenTarget,
  billedTokensConsumed: row.billedTokensConsumed,
  status: row.status,
  createdAt: row.createdAt,
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
});

const resolveDatabase = async (
  database?: TokenBurnerDatabase,
): Promise<TokenBurnerDatabase> => {
  if (database) {
    return database;
  }

  const client = await import("./client");
  return client.db;
};

const getWindowStart = (windowSizeInMilliseconds: number, now: Date) =>
  new Date(now.getTime() - windowSizeInMilliseconds);

const mapLeaderboardRows = (
  rows: LeaderboardRow[],
  limit: number,
): ProviderSplitLeaderboard => {
  const splitResults = createEmptyProviderRecord<LeaderboardEntry[]>(() => []);

  for (const provider of providerValues) {
    const providerRows = rows.filter((row) => row.provider === provider);

    splitResults[provider] = providerRows.slice(0, limit).map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }

  return splitResults;
};

const getProviderLeaderboard = async ({
  database,
  limit = 10,
  now,
  windowStart,
}: TimedQueryOptions & {
  windowStart?: Date;
}): Promise<ProviderSplitLeaderboard> => {
  const queryDatabase = await resolveDatabase(database);
  const conditions = [inArray(burns.status, terminalBurnStatusValues)];

  if (windowStart) {
    conditions.push(gte(burns.createdAt, windowStart));
  }

  const rows = await queryDatabase
    .select({
      burnId: burns.id,
      humanId: humans.id,
      handle: humans.publicHandle,
      avatarUrl: humans.avatarUrl,
      provider: burns.provider,
      model: burns.model,
      requestedBilledTokenTarget: burns.requestedBilledTokenTarget,
      billedTokensConsumed: burns.billedTokensConsumed,
      status: burns.status,
      createdAt: burns.createdAt,
      startedAt: burns.startedAt,
      finishedAt: burns.finishedAt,
    })
    .from(burns)
    .innerJoin(humans, eq(burns.humanId, humans.id))
    .where(and(...conditions))
    .orderBy(desc(burns.billedTokensConsumed), desc(burns.createdAt));

  return mapLeaderboardRows(rows, limit);
};

export const getProviderDailyLeaderboard = async ({
  now = new Date(),
  ...options
}: TimedQueryOptions = {}): Promise<ProviderSplitLeaderboard> =>
  getProviderLeaderboard({
    ...options,
    now,
    windowStart: getWindowStart(dayInMilliseconds, now),
  });

export const getProviderWeeklyLeaderboard = async ({
  now = new Date(),
  ...options
}: TimedQueryOptions = {}): Promise<ProviderSplitLeaderboard> =>
  getProviderLeaderboard({
    ...options,
    now,
    windowStart: getWindowStart(weekInMilliseconds, now),
  });

export const getProviderAllTimeLeaderboard = async (
  options: QueryOptions & {
    limit?: number;
  } = {},
): Promise<ProviderSplitLeaderboard> => getProviderLeaderboard(options);

export const getLiveBurnFeed = async ({
  database,
  limit = 10,
}: TimedQueryOptions = {}): Promise<LiveBurnFeedEntry[]> => {
  const queryDatabase = await resolveDatabase(database);

  const rows = await queryDatabase
    .select({
      burnId: burns.id,
      humanId: humans.id,
      handle: humans.publicHandle,
      avatarUrl: humans.avatarUrl,
      provider: burns.provider,
      model: burns.model,
      requestedBilledTokenTarget: burns.requestedBilledTokenTarget,
      billedTokensConsumed: burns.billedTokensConsumed,
      status: burns.status,
      createdAt: burns.createdAt,
      startedAt: burns.startedAt,
      finishedAt: burns.finishedAt,
      lastHeartbeatAt: burns.lastHeartbeatAt,
    })
    .from(burns)
    .innerJoin(humans, eq(burns.humanId, humans.id))
    .where(inArray(burns.status, activeBurnStatuses))
    .orderBy(desc(burns.lastHeartbeatAt), desc(burns.createdAt))
    .limit(limit);

  return rows;
};

export const getPublicProfileByHandle = async (
  handle: string,
  { database, recentBurnLimit = 10 }: RecentBurnOptions = {},
): Promise<PublicProfile | null> => {
  const normalizedHandle = handle.trim().toLowerCase();

  if (!normalizedHandle) {
    return null;
  }

  const queryDatabase = await resolveDatabase(database);

  const [humanRecord] = await queryDatabase
    .select({
      humanId: humans.id,
      handle: humans.publicHandle,
      avatarUrl: humans.avatarUrl,
    })
    .from(humans)
    .where(sql`lower(${humans.publicHandle}) = ${normalizedHandle}`)
    .limit(1);

  if (!humanRecord) {
    return null;
  }

  const [recentBurns, providerTotalsRows] = await Promise.all([
    queryDatabase
      .select({
        burnId: burns.id,
        provider: burns.provider,
        model: burns.model,
        requestedBilledTokenTarget: burns.requestedBilledTokenTarget,
        billedTokensConsumed: burns.billedTokensConsumed,
        status: burns.status,
        createdAt: burns.createdAt,
        startedAt: burns.startedAt,
        finishedAt: burns.finishedAt,
      })
      .from(burns)
      .where(eq(burns.humanId, humanRecord.humanId))
      .orderBy(desc(burns.createdAt))
      .limit(recentBurnLimit),
    queryDatabase
      .select({
        provider: burns.provider,
        totalBilledTokens: sql<string>`coalesce(sum(${burns.billedTokensConsumed}), 0)`,
      })
      .from(burns)
      .where(eq(burns.humanId, humanRecord.humanId))
      .groupBy(burns.provider),
  ]);

  const providerTotals = createEmptyProviderRecord<number>(() => 0);

  for (const row of providerTotalsRows) {
    providerTotals[row.provider] = normalizeNumericValue(row.totalBilledTokens);
  }

  return {
    humanId: humanRecord.humanId,
    handle: humanRecord.handle,
    avatarUrl: humanRecord.avatarUrl,
    providerTotals,
    recentBurns: recentBurns.map(mapBurnSummary),
  };
};

export const getPublicBurnById = async (
  burnId: string,
  { database }: QueryOptions = {},
): Promise<PublicBurn | null> => {
  const queryDatabase = await resolveDatabase(database);

  const [row] = await queryDatabase
    .select({
      burnId: burns.id,
      humanId: humans.id,
      handle: humans.publicHandle,
      avatarUrl: humans.avatarUrl,
      provider: burns.provider,
      model: burns.model,
      requestedBilledTokenTarget: burns.requestedBilledTokenTarget,
      billedTokensConsumed: burns.billedTokensConsumed,
      status: burns.status,
      createdAt: burns.createdAt,
      startedAt: burns.startedAt,
      finishedAt: burns.finishedAt,
    })
    .from(burns)
    .innerJoin(humans, eq(burns.humanId, humans.id))
    .where(eq(burns.id, burnId))
    .limit(1);

  return row ?? null;
};
