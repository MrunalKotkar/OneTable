import { inArray } from "drizzle-orm";
import { demoDiners } from "@/data/demo-fixtures";
import { db } from "@/db/client";
import { beliefs, diners, groupMembers, groups, mealOutcomes } from "@/db/schema";
import { DEMO_GROUP_ID } from "./demo-group";

/**
 * DB-aware "restart demo" reset: wipes every belief for the demo diners
 * (including any revisions since the last reset) and every meal outcome
 * for the demo group, then reseeds diners/beliefs from `demoDiners`
 * verbatim — the DB-backed equivalent of the mock gateway's
 * `resetStore()`, which just replaces its module-scoped state wholesale.
 *
 * table-store.ts's resetAll() calls this (when a DB is configured)
 * alongside deleting every table, so "Restart demo" behaves the same
 * regardless of which memory gateway is active.
 */
export async function resetDemoGroupState(): Promise<void> {
  const dinerIds = demoDiners.map((d) => d.id);

  // meal_outcomes has no FK to beliefs/diners beyond dinerId references on
  // its feedback rows (ON DELETE CASCADE from meal_outcomes -> feedback),
  // so deleting the group's outcomes is enough to clear both.
  await db.delete(mealOutcomes).where(inArray(mealOutcomes.groupId, [DEMO_GROUP_ID]));
  await db.delete(beliefs).where(inArray(beliefs.dinerId, dinerIds));

  await db.insert(groups).values({ id: DEMO_GROUP_ID }).onConflictDoNothing({ target: groups.id });

  for (const diner of demoDiners) {
    await db
      .insert(diners)
      .values({ id: diner.id, name: diner.name, initials: diner.initials })
      .onConflictDoUpdate({
        target: diners.id,
        set: { name: diner.name, initials: diner.initials },
      });

    await db
      .insert(groupMembers)
      .values({ groupId: DEMO_GROUP_ID, dinerId: diner.id })
      .onConflictDoNothing({ target: [groupMembers.groupId, groupMembers.dinerId] });

    for (const belief of diner.beliefs) {
      await db
        .insert(beliefs)
        .values({
          id: belief.id,
          dinerId: diner.id,
          kind: belief.kind,
          value: String(belief.value),
          status: belief.status,
          updatedAt: new Date(belief.updatedAt),
          supersedes: belief.supersedes,
        })
        .onConflictDoUpdate({
          target: beliefs.id,
          set: {
            kind: belief.kind,
            value: String(belief.value),
            status: belief.status,
            updatedAt: new Date(belief.updatedAt),
            supersedes: belief.supersedes,
          },
        });
    }
  }
}
