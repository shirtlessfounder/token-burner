import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

type TokenBurnerDatabase = NodePgDatabase<typeof schema>;

type GlobalDatabaseCache = typeof globalThis & {
  __tokenBurnerPool__?: Pool;
  __tokenBurnerDb__?: TokenBurnerDatabase;
};

const globalCache = globalThis as GlobalDatabaseCache;

export const getDatabaseUrl = (): string => {
  const databaseUrl =
    process.env.DATABASE_URL ?? process.env.DATABASE_URL_MIGRATIONS;

  if (databaseUrl) {
    return databaseUrl;
  }

  throw new Error(
    "Set DATABASE_URL or DATABASE_URL_MIGRATIONS before using the site database client.",
  );
};

export const pool =
  globalCache.__tokenBurnerPool__ ??
  new Pool({
    connectionString: getDatabaseUrl(),
  });

export const db =
  globalCache.__tokenBurnerDb__ ?? drizzle({ client: pool, schema });

if (process.env.NODE_ENV !== "production") {
  globalCache.__tokenBurnerPool__ = pool;
  globalCache.__tokenBurnerDb__ = db;
}
