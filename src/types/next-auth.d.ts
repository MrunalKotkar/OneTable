import type { DefaultSession } from "next-auth";

/**
 * Extends Auth.js's session/JWT shape with the two claims OneTable actually
 * needs downstream: which diner a signed-in user is, and whether they can
 * reach /admin. Both are set once in auth.ts's jwt callback (at sign-in,
 * where the DB is reachable) and carried in the JWT after that, so
 * middleware (edge runtime, no DB) can read them straight off the token.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    isAdmin?: boolean;
  }
}
