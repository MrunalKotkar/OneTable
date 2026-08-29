import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The one Drizzle client for the app. Nothing imports this yet as of
 * Phase 1 (PRODUCTION_REBUILD_PLAN.md) — it exists so `db:generate`/
 * `db:migrate` have something to point at, and so Phase 2+ gateways have
 * one place to import `db` from.
 */

// Next.js loads .env.local for us under `next dev`/`next build`. Standalone
// scripts (tsx, vitest) don't get that for free, so fall back to loading it
// ourselves — same approach as drizzle.config.ts.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Optional — fine if DATABASE_URL is already set some other way.
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not configured. Copy .env.example to .env.local and fill it in.",
  );
}

declare global {
  // Reused across hot reloads in dev so we don't leak a new connection pool
  // on every file save; a fresh serverless invocation in prod just makes
  // one small pool (max: 1) and lets it go.
  var __onetablePostgresClient: ReturnType<typeof postgres> | undefined;
}

const isProduction = process.env.NODE_ENV === "production";

const client =
  globalThis.__onetablePostgresClient ??
  postgres(connectionString, { max: isProduction ? 1 : 10 });

if (!isProduction) {
  globalThis.__onetablePostgresClient = client;
}

export const db = drizzle(client, { schema });
