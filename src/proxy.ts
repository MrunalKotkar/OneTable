import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Protects table actions and /admin (Phase 5 of
 * PRODUCTION_REBUILD_PLAN.md) — edge runtime, so this uses the DB-free
 * auth.config.ts rather than the full auth.ts. The `authorized` callback
 * in auth.config.ts does the actual allow/deny decision; this file is
 * just the wiring.
 *
 * Named `proxy.ts`, not `middleware.ts` — Next.js 16 renamed the
 * convention (the old name still works but is deprecated).
 */
export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Run on everything except:
     *  - Next.js internals and static files
     *  - anything with a file extension (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
