import type {
  Belief,
  BeliefKind,
  BeliefRevision,
  GroupContext,
  GroupMealSummary,
  MealOutcome,
} from "@/domain/contracts";
import type { MemoryGateway, ReviseBeliefInput } from "./contract";
import {
  activeBeliefs,
  addOutcome,
  getDiner,
  getDiners,
  getOutcomes,
  replaceBeliefs,
} from "./store";

/**
 * Deterministic, in-process implementation of the MemoryGateway.
 *
 * This is the demo-ready provider: it needs no network, no XTrace, and no
 * seeding step beyond the shared fixtures. Persons 2-4 build against the
 * GroupContext this returns.
 */

/** Records the most recent revision per (diner, kind) so the audit UI can read it. */
const revisions = new Map<string, BeliefRevision>();

/** Monotonic counter to keep revised belief ids stable and unique within a run. */
let revisionSeq = 0;

function revisionKey(dinerId: string, kind: BeliefKind): string {
  return `${dinerId}:${kind}`;
}

/**
 * Choose which existing active belief a correction supersedes.
 *
 * 1. A same-kind active belief is the direct replacement (e.g. a new budget
 *    supersedes the old budget).
 * 2. Otherwise, introducing a hard restriction (allergy/diet) supersedes an
 *    active "no dietary restrictions" marker. This is Jordan's path: the
 *    correction is an ALLERGY, but the belief it retires is the DIET belief
 *    that asserted no constraints.
 */
function pickSupersededBelief(
  active: Belief[],
  kind: BeliefKind,
): Belief | null {
  const sameKind = active.find((b) => b.kind === kind);
  if (sameKind) return sameKind;

  if (kind === "allergy" || kind === "diet") {
    const unrestricted = active.find(
      (b) => b.kind === "diet" && b.value === "no dietary restrictions",
    );
    if (unrestricted) return unrestricted;
  }

  return null;
}

export const mockMemoryGateway: MemoryGateway = {
  async recallGroupContext(
    groupId: string,
    dinerIds: string[],
    intent: string,
  ): Promise<GroupContext> {
    const diners = getDiners(dinerIds).map((diner) => ({
      ...diner,
      // Negotiation must only ever see active beliefs.
      beliefs: activeBeliefs(diner),
    }));

    const history: GroupMealSummary[] = getOutcomes()
      .filter((o) => o.groupId === groupId)
      .map((o) => ({
        restaurant: o.restaurantId,
        occurredAt: o.completedAt,
        rating: averageRating(o),
      }));

    return { groupId, intent, diners, history };
  },

  async reviseBelief(input: ReviseBeliefInput): Promise<BeliefRevision> {
    const diner = getDiner(input.dinerId);
    if (!diner) {
      throw new Error(`Unknown diner: ${input.dinerId}`);
    }

    const active = activeBeliefs(diner);
    const previousMatch = pickSupersededBelief(active, input.kind);
    const now = new Date().toISOString();

    // Always produce a well-formed `previous`, even if there was no prior
    // belief to retire (synthetic "none" so the audit UI has both sides).
    const previous: Belief = previousMatch ?? {
      id: `${input.dinerId}-${input.kind}-none`,
      kind: input.kind,
      value: "none",
      status: "superseded",
      updatedAt: now,
      supersedes: null,
    };

    const current: Belief = {
      id: `${input.dinerId}-${input.kind}-rev-${++revisionSeq}`,
      kind: input.kind,
      value: input.value,
      status: "active",
      updatedAt: now,
      supersedes: previous.id,
    };

    // Rebuild the diner's belief list: retire the superseded belief, keep the
    // rest untouched, append the new active belief.
    const nextBeliefs = diner.beliefs.map((b) =>
      previousMatch && b.id === previousMatch.id
        ? { ...b, status: "superseded" as const, updatedAt: now }
        : b,
    );
    nextBeliefs.push(current);
    replaceBeliefs(input.dinerId, nextBeliefs);

    const revision: BeliefRevision = {
      dinerId: input.dinerId,
      previous: { ...previous, status: "superseded" },
      current,
    };
    revisions.set(revisionKey(input.dinerId, input.kind), revision);
    return revision;
  },

  async getBeliefHistory(
    dinerId: string,
    kind: BeliefKind,
  ): Promise<BeliefRevision | null> {
    return revisions.get(revisionKey(dinerId, kind)) ?? null;
  },

  async saveMealOutcome(outcome: MealOutcome): Promise<void> {
    addOutcome(outcome);
  },
};

function averageRating(outcome: MealOutcome): number {
  if (outcome.feedback.length === 0) return 0;
  const liked = outcome.feedback.filter((f) => f.liked).length;
  // Simple 1-5 scale derived from the like ratio.
  return Math.round((liked / outcome.feedback.length) * 4) + 1;
}
