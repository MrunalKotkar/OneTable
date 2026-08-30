import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { diners, groups } from "@/db/schema";

/** "Jordan Lee" -> "JL"; a bare email local-part falls back to its first two characters. */
function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * One diners row per user, lazily created on first sign-in (Phase 5 of
 * PRODUCTION_REBUILD_PLAN.md) — called from auth.ts's Credentials
 * `authorize()`, which only ever runs in the Node runtime, never on the
 * edge. Idempotent: a user who already has a diner just gets it back.
 */
export async function getOrCreateDinerForUser(user: {
  id: string;
  name: string | null;
  email: string;
}): Promise<typeof diners.$inferSelect> {
  const [existing] = await db.select().from(diners).where(eq(diners.userId, user.id));
  if (existing) return existing;

  const name = user.name?.trim() || user.email.split("@")[0];
  const [created] = await db
    .insert(diners)
    .values({ userId: user.id, name, initials: initialsFor(name) })
    .returning();
  return created;
}

/** The diner linked to a signed-in user — every API route that needs "who is this?" starts here. */
export async function getDinerForUser(userId: string): Promise<typeof diners.$inferSelect | null> {
  const [diner] = await db.select().from(diners).where(eq(diners.userId, userId));
  return diner ?? null;
}

/**
 * A table-creator's recurring circle — one groups row per user, reused for
 * every table they create (the minimal-scope answer to "what is a group"
 * now that diners aren't a fixed cast of 4). Lazily created the first time
 * someone actually creates a table, not at sign-in.
 */
export async function getOrCreateGroupForDiner(dinerId: string): Promise<string> {
  const [existing] = await db.select().from(groups).where(eq(groups.ownerDinerId, dinerId));
  if (existing) return existing.id;

  const [created] = await db.insert(groups).values({ ownerDinerId: dinerId }).returning();
  return created.id;
}

/** The group a diner owns (created themself), if any — null for a diner who has only ever joined others' tables. */
export async function getOwnedGroupIdForDiner(dinerId: string): Promise<string | null> {
  const [existing] = await db.select().from(groups).where(eq(groups.ownerDinerId, dinerId));
  return existing?.id ?? null;
}
