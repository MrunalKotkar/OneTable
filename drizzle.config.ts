import { defineConfig } from "drizzle-kit";

// drizzle-kit runs standalone (outside Next.js), so .env.local isn't loaded
// for us the way it is for `next dev`/`next build`. Load it ourselves,
// unless DATABASE_URL is already set (CI, or a hosting provider's env).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // .env.local is optional — fine if DATABASE_URL comes from elsewhere.
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in " +
      "(docker compose up -d for local dev), or set it in your shell/CI.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
