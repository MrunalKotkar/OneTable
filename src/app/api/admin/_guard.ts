import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";

/** Shared gate for every /api/admin/** route. See src/lib/admin-auth.ts for why this is a cookie, not a session. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const authorized = await isAdminRequest();
  if (!authorized) {
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
