import { cookies } from "next/headers";

/**
 * Temporary admin gate for /admin/restaurants (Phase 2 of
 * PRODUCTION_REBUILD_PLAN.md). Real admin gating needs a signed-in user and
 * a `users.is_admin` flag to check — neither exists until Auth.js lands in
 * Phase 5, and building throwaway auth just to unblock the catalog UI isn't
 * worth it. This is a single shared-secret cookie instead: good enough to
 * keep the catalog UI off the public internet in the meantime, and it gets
 * deleted outright once Phase 5's real session check replaces it.
 */

export const ADMIN_COOKIE = "onetable_admin";

function adminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

/** True once ADMIN_SECRET is actually configured — the admin area refuses to open without it. */
export function isAdminConfigured(): boolean {
  return adminSecret() !== null;
}

export function checkAdminPassword(candidate: string): boolean {
  const secret = adminSecret();
  return secret !== null && candidate === secret;
}

export async function isAdminRequest(): Promise<boolean> {
  const secret = adminSecret();
  if (!secret) return false;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === secret;
}
