import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { beliefs, diners, dishes, feedback, mealOutcomes } from "@/db/schema";
import type {
  Belief,
  BeliefKind,
  BeliefRevision,
  DinerProfile,
  GroupContext,
  GroupMealSummary,
  MealOutcome,
  PastOrder,
} from "@/domain/contracts";
import type { MemoryGateway, ReviseBeliefInput } from "./contract";
import { pickSupersededBelief } from "./supersession";

/**
 * DB-backed MemoryGateway (Phase 3 of PRODUCTION_REBUILD_PLAN.md), replacing
 * both the in-memory mock's module-scoped Map (for real deployments) and
 * XTrace (dropped entirely — see git history for why: it didn't retire
 * contradicted beliefs and dropped structure, so the mock/db gateways
 * always owned supersession themselves anyway).
 *
 * Same contract, same guarantee: recall returns active beliefs only, a
 * revision produces a well-formed {previous, current} pair.
 */

type BeliefRow = typeof beliefs.$inferSelect;

const NUMERIC_BELIEF_KINDS: BeliefKind[] = ["budget"];

function parseBeliefValue(kind: BeliefKind, raw: string): string | number {
  return NUMERIC_BELIEF_KINDS.includes(kind) ? Number(raw) : raw;
}

function serializeBeliefValue(value: string | number): string {
  return String(value);
}

function toBelief(row: BeliefRow): Belief {
  return {
    id: row.id,
    kind: row.kind,
    value: parseBeliefValue(row.kind, row.value),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
    supersedes: row.supersedes,
  };
}

async function activeBeliefsFor(dinerId: string): Promise<Belief[]> {
  const rows = await db
    .select()
    .from(beliefs)
    .where(and(eq(beliefs.dinerId, dinerId), eq(beliefs.status, "active")));
  return rows.map(toBelief);
}

async function pastOrdersFor(dinerId: string): Promise<PastOrder[]> {
  const rows = await db
    .select({
      restaurantId: mealOutcomes.restaurantId,
      dishName: dishes.name,
      liked: feedback.liked,
    })
    .from(feedback)
    .innerJoin(mealOutcomes, eq(feedback.mealOutcomeId, mealOutcomes.id))
    .innerJoin(dishes, eq(feedback.dishId, dishes.id))
    .where(eq(feedback.dinerId, dinerId));

  return rows.map((row) => ({
    restaurant: row.restaurantId,
    dish: row.dishName,
    liked: row.liked,
  }));
}

function averageRating(liked: boolean[]): number {
  if (liked.length === 0) return 0;
  const likedCount = liked.filter(Boolean).length;
  return Math.round((likedCount / liked.length) * 4) + 1;
}

export const dbMemoryGateway: MemoryGateway = {
  async recallGroupContext(
    groupId: string,
    dinerIds: string[],
    intent: string,
  ): Promise<GroupContext> {
    // dinerIds can legitimately be empty — table-store.ts's getGroupHistory
    // calls this with [] specifically to get `history` back with no diner
    // lookup at all, so that (and NOT an early return skipping history
    // entirely) is what has to handle the empty case.
    const dinerRows =
      dinerIds.length === 0 ? [] : await db.select().from(diners).where(inArray(diners.id, dinerIds));

    const dinerProfiles: DinerProfile[] = await Promise.all(
      dinerRows.map(async (row) => ({
        id: row.id,
        name: row.name,
        initials: row.initials,
        beliefs: await activeBeliefsFor(row.id),
        pastOrders: await pastOrdersFor(row.id),
      })),
    );
    // Preserve caller order (dinerIds), same as the mock's getDiners().
    const byId = new Map(dinerProfiles.map((d) => [d.id, d]));
    const orderedDiners = dinerIds
      .map((id) => byId.get(id))
      .filter((d): d is DinerProfile => d !== undefined);

    const outcomeRows = await db
      .select()
      .from(mealOutcomes)
      .where(eq(mealOutcomes.groupId, groupId));

    const history: GroupMealSummary[] = await Promise.all(
      outcomeRows.map(async (outcome) => {
        const feedbackRows = await db
          .select({ liked: feedback.liked })
          .from(feedback)
          .where(eq(feedback.mealOutcomeId, outcome.id));
        return {
          restaurant: outcome.restaurantId,
          occurredAt: outcome.completedAt.toISOString(),
          rating: averageRating(feedbackRows.map((f) => f.liked)),
        };
      }),
    );

    return { groupId, intent, diners: orderedDiners, history };
  },

  async reviseBelief(input: ReviseBeliefInput): Promise<BeliefRevision> {
    const [diner] = await db.select().from(diners).where(eq(diners.id, input.dinerId));
    if (!diner) {
      throw new Error(`Unknown diner: ${input.dinerId}`);
    }

    return db.transaction(async (tx) => {
      const active = await tx
        .select()
        .from(beliefs)
        .where(and(eq(beliefs.dinerId, input.dinerId), eq(beliefs.status, "active")));
      const previousMatch = pickSupersededBelief(active.map(toBelief), input.kind);
      const now = new Date();

      let previousRow: BeliefRow;
      if (previousMatch) {
        const [updated] = await tx
          .update(beliefs)
          .set({ status: "superseded", updatedAt: now })
          .where(eq(beliefs.id, previousMatch.id))
          .returning();
        previousRow = updated;
      } else {
        // Always persist a well-formed `previous`, even when there was no
        // prior belief to retire, so getBeliefHistory can reconstruct the
        // pair from the DB alone (current.supersedes always points at a
        // real row) rather than needing a process-local cache.
        const [inserted] = await tx
          .insert(beliefs)
          .values({
            dinerId: input.dinerId,
            kind: input.kind,
            value: "none",
            status: "superseded",
            updatedAt: now,
            supersedes: null,
          })
          .returning();
        previousRow = inserted;
      }

      const [currentRow] = await tx
        .insert(beliefs)
        .values({
          dinerId: input.dinerId,
          kind: input.kind,
          value: serializeBeliefValue(input.value),
          status: "active",
          updatedAt: now,
          supersedes: previousRow.id,
        })
        .returning();

      return {
        dinerId: input.dinerId,
        previous: toBelief(previousRow),
        current: toBelief(currentRow),
      };
    });
  },

  async getBeliefHistory(
    dinerId: string,
    kind: BeliefKind,
  ): Promise<BeliefRevision | null> {
    // The most recent belief of this kind that resulted from an actual
    // revision (supersedes IS NOT NULL) — a belief still on its initial
    // seed value was never revised, so there's no pair to show.
    const [current] = await db
      .select()
      .from(beliefs)
      .where(
        and(
          eq(beliefs.dinerId, dinerId),
          eq(beliefs.kind, kind),
          eq(beliefs.status, "active"),
          isNotNull(beliefs.supersedes),
        ),
      )
      .orderBy(desc(beliefs.updatedAt))
      .limit(1);
    if (!current || !current.supersedes) return null;

    const [previous] = await db.select().from(beliefs).where(eq(beliefs.id, current.supersedes));
    if (!previous) return null;

    return { dinerId, previous: toBelief(previous), current: toBelief(current) };
  },

  async saveMealOutcome(outcome: MealOutcome): Promise<void> {
    const [row] = await db
      .insert(mealOutcomes)
      .values({
        groupId: outcome.groupId,
        recommendationVersion: outcome.recommendationVersion,
        restaurantId: outcome.restaurantId,
        completedAt: new Date(outcome.completedAt),
      })
      .returning();

    if (outcome.feedback.length > 0) {
      await db.insert(feedback).values(
        outcome.feedback.map((entry) => ({
          mealOutcomeId: row.id,
          dinerId: entry.dinerId,
          dishId: entry.dishId,
          liked: entry.liked,
          note: entry.note ?? null,
        })),
      );
    }
  },
};
