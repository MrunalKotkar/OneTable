import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/**
 * The edge-safe half of the Auth.js config (Phase 5 of
 * PRODUCTION_REBUILD_PLAN.md) — no adapter, no providers with DB access,
 * so middleware.ts can import this without ever touching Postgres from
 * the edge runtime. auth.ts spreads this in and adds the rest (Credentials
 * provider, DrizzleAdapter).
 *
 * jwt/session callbacks live HERE, not just in auth.ts: proxy.ts's edge
 * `auth()` call is built from this config alone, so if the isAdmin
 * projection only existed in auth.ts's callbacks, `auth.user.isAdmin`
 * would be undefined in the edge `authorized` callback below and every
 * admin route would 403 no matter who was signed in — found exactly that
 * bug while testing this phase.
 */
export const authConfig = {
  pages: {
    signIn: "/signin",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.isAdmin = token.isAdmin ?? false;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isApiRoute = pathname.startsWith("/api/");

      // Auth.js's own routes, the sign-in/sign-up pages and their API,
      // and a couple of endpoints that must stay reachable without a
      // session (health check, the Stripe webhook once Phase 6 wires it).
      const publicPaths = ["/signin", "/signup", "/api/auth", "/api/health", "/api/webhooks"];
      if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
        return true;
      }

      const adminPaths = ["/admin", "/api/admin", "/api/reset"];
      const needsAdmin = adminPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
      const allowed = isLoggedIn && (!needsAdmin || auth?.user.isAdmin === true);
      if (allowed) return true;

      // The default deny behavior redirects to the sign-in page — right
      // for a document request, but a fetch() from client JS would just
      // follow the redirect and get sign-in HTML back instead of JSON. API
      // routes get a real 401/403 instead.
      if (isApiRoute) {
        return NextResponse.json(
          { error: isLoggedIn ? "forbidden" : "unauthorized" },
          { status: isLoggedIn ? 403 : 401 },
        );
      }
      return false;
    },
  },
} satisfies NextAuthConfig;
