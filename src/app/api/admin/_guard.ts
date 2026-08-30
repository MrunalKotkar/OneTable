import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Shared gate for every /api/admin/** route. middleware.ts already turns
 * away a non-admin request before it gets here (Phase 5's real
 * users.is_admin session check, replacing Phase 2's temporary
 * ADMIN_SECRET cookie) — this is defense-in-depth, not the primary gate.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}
