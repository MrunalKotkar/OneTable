import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDinerForUser } from "@/server/identity";

/**
 * Shared "who is making this request" resolution for every /api/tables/**
 * route (Phase 5) — middleware.ts already turns away an unauthenticated
 * request before it gets here, so `unauthorized` below is a defense-in-depth
 * backstop, not the primary gate.
 */
export async function requireDiner(): Promise<
  { ok: true; diner: { id: string; name: string; initials: string } } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const diner = await getDinerForUser(session.user.id);
  if (!diner) {
    return { ok: false, response: NextResponse.json({ error: "no_diner" }, { status: 500 }) };
  }

  return { ok: true, diner };
}
