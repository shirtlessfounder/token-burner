const migrationsUrl =
  process.env.DATABASE_URL_MIGRATIONS ?? process.env.DATABASE_URL;

if (!migrationsUrl) {
  throw new Error(
    "Set DATABASE_URL_MIGRATIONS or DATABASE_URL before running Drizzle commands.",
  );
}

export default {
  schema: "./apps/site/src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationsUrl,
  },
  verbose: true,
  strict: true,
};
