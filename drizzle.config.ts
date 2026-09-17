import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Keep PostgreSQL migrations separate from the D1 migrations in ./drizzle.
  // Sites packages ./drizzle for D1 and would otherwise attempt to run both
  // dialects against the same SQLite database.
  out: "./drizzle-postgres",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL ||
      "postgresql://placeholder.invalid/em2",
  },
});
