import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { authConfig } from "./auth.config";
import { db } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { getOrCreateDinerForUser } from "@/server/identity";

/**
 * The full Auth.js config (Phase 5) — Node runtime only (imports the DB
 * client), unlike auth.config.ts. Credentials (email+password): the
 * adapter's `accounts`/`sessions`/`verification_tokens` tables stay mostly
 * unused with this provider (no OAuth, no magic links, JWT session
 * strategy) but cost nothing to keep wired up for a future provider.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : null;
        const password = typeof credentials?.password === "string" ? credentials.password : null;
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Lazily ensure this user has a diner (Phase 5) — authorize() only
        // ever runs in the Node runtime (never on the edge), so it's safe
        // to hit the DB here on every successful sign-in.
        await getOrCreateDinerForUser({ id: user.id, name: user.name, email: user.email });

        return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin };
      },
    }),
  ],
  // jwt/session/authorized callbacks all come from authConfig (spread
  // above) — see the comment in auth.config.ts for why they live there
  // instead of here.
});
