import type {
  Belief,
  BeliefKind,
  BeliefRevision,
  DinerProfile,
  GroupContext,
  GroupMealSummary,
  MealOutcome,
} from "@/domain/contracts";
import { demoDiners } from "@/data/demo-fixtures";
import type { MemoryGateway, ReviseBeliefInput } from "./contract";
import {
  RECALL_QUERY,
  deleteMemory,
  listAllMemoryIds,
  searchFacts,
  writeFact,
} from "./xtrace-client";

/**
 * XTrace-backed MemoryGateway.
 *
 * XTrace is the durable write/recall/delete store, but two of its behaviors mean
 * it can't be the sole source of truth:
 *   1. It stores LLM-normalized prose ("User is allergic to shellfish."), not our
 *      structured {kind, value}, and drops custom metadata.
 *   2. It does NOT retire contradicted beliefs — recall returns both as "active".
 *
 * So this adapter keeps STRUCTURE and SUPERSESSION app-side while genuinely using
 * XTrace for persistence:
 *   - Each diner maps to one XTrace user_id (`onetable_<dinerId>`).
 *   - An in-process index maps XTrace memory id -> the structured Belief we wrote.
 *   - Recall pulls the diner's live facts from XTrace and rebuilds Beliefs via the
 *     index. Because a superseded belief's memory is DELETED from XTrace on
 *     revision, recall is active-only at both layers. The retired belief is kept
 *     in a history overlay so the audit UI can still show before/after.
 *
 * Identity (name/initials/pastOrders) and group meal history stay app-side —
 * XTrace models per-user beliefs, not identities or group meals.
 *
 * Process-scoped state (index/overlay), like the mock's store, survives across
 * requests in one server process (that is what the fresh-session demo proves),
 * not across a full restart. Seeding wipes + rewrites each diner's XTrace
 * memories once per process so XTrace and the index never drift or duplicate.
 */

function userIdFor(dinerId: string): string {
  return `onetable_${dinerId}`;
}

interface IndexEntry {
  memoryId: string;
  dinerId: string;
  beliefId: string;
  kind: BeliefKind;
  value: string | number;
  updatedAt: string;
}

/** XTrace memory id -> the structured belief we wrote for it. */
const index = new Map<string, IndexEntry>();
/** `${dinerId}:${kind}` -> latest revision, for the audit UI. */
const revisions = new Map<string, BeliefRevision>();
const outcomes: MealOutcome[] = [];

let seeded = false;
let seeding: Promise<void> | null = null;
let revisionSeq = 0;

function revisionKey(dinerId: string, kind: BeliefKind): string {
  return `${dinerId}:${kind}`;
}

/** A sentence XTrace reliably extracts as exactly one fact. */
function sentenceFor(kind: BeliefKind, value: string | number): string {
  switch (kind) {
    case "diet":
      return value === "no dietary restrictions"
        ? "I have no dietary restrictions."
        : `I follow a ${value} diet.`;
    case "allergy":
      return `I am allergic to ${value}.`;
    case "budget":
      return `My budget is $${value} per meal.`;
    case "goal":
      return `My dining goal is ${value}.`;
    case "preference":
      return `I prefer ${value}.`;
    case "dislike":
      return `I dislike ${value}.`;
  }
}

async function writeBelief(dinerId: string, belief: Belief): Promise<void> {
  const { id: memoryId } = await writeFact(
    userIdFor(dinerId),
    belief.id,
    sentenceFor(belief.kind, belief.value),
  );
  index.set(memoryId, {
    memoryId,
    dinerId,
    beliefId: belief.id,
    kind: belief.kind,
    value: belief.value,
    updatedAt: belief.updatedAt,
  });
}

/**
 * Deterministic per-process seed: wipe each diner's XTrace memories, then write
 * the fixture beliefs fresh. Keeps XTrace and the in-process index consistent
 * (no duplicate facts across restarts) and mirrors the mock's seed-on-start.
 * Runs once, lazily, guarded so concurrent recalls share a single seed.
 */
async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  if (!seeding) {
    seeding = (async () => {
      for (const diner of demoDiners) {
        const existing = await listAllMemoryIds(userIdFor(diner.id));
        await Promise.all(existing.map((id) => deleteMemory(id)));
        for (const belief of diner.beliefs) {
          await writeBelief(diner.id, belief);
        }
      }
      seeded = true;
    })();
  }
  await seeding;
}

async function recallDinerBeliefs(dinerId: string): Promise<Belief[]> {
  const facts = await searchFacts(userIdFor(dinerId), RECALL_QUERY);
  const beliefs: Belief[] = [];
  for (const fact of facts) {
    const entry = index.get(fact.id);
    // Skip anything we didn't write (stray extractions / unmapped ids).
    if (!entry) continue;
    beliefs.push({
      id: entry.beliefId,
      kind: entry.kind,
      value: entry.value,
      status: "active",
      updatedAt: entry.updatedAt,
      supersedes: null,
    });
  }
  return beliefs;
}

/** Mirrors the mock: same-kind supersedes; else a new hard restriction retires
 *  the "no dietary restrictions" marker (Jordan's path). */
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

export const xtraceMemoryGateway: MemoryGateway = {
  async recallGroupContext(
    groupId: string,
    dinerIds: string[],
    intent: string,
  ): Promise<GroupContext> {
    await ensureSeeded();

    const diners: DinerProfile[] = [];
    for (const dinerId of dinerIds) {
      const identity = demoDiners.find((d) => d.id === dinerId);
      if (!identity) continue;
      diners.push({
        id: identity.id,
        name: identity.name,
        initials: identity.initials,
        beliefs: await recallDinerBeliefs(dinerId),
        pastOrders: identity.pastOrders,
      });
    }

    const history: GroupMealSummary[] = outcomes
      .filter((o) => o.groupId === groupId)
      .map((o) => ({
        restaurant: o.restaurantId,
        occurredAt: o.completedAt,
        rating: averageRating(o),
      }));

    return { groupId, intent, diners, history };
  },

  async reviseBelief(input: ReviseBeliefInput): Promise<BeliefRevision> {
    await ensureSeeded();

    const active = await recallDinerBeliefs(input.dinerId);
    const previousMatch = pickSupersededBelief(active, input.kind);
    const now = new Date().toISOString();

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

    // Persist the correction to XTrace...
    await writeBelief(input.dinerId, current);

    // ...then hard-delete the superseded belief's memory so XTrace recall is
    // active-only (XTrace won't retire it natively). History overlay keeps it.
    if (previousMatch) {
      const stale = [...index.values()].find(
        (e) => e.dinerId === input.dinerId && e.beliefId === previousMatch.id,
      );
      if (stale) {
        await deleteMemory(stale.memoryId);
        index.delete(stale.memoryId);
      }
    }

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
    outcomes.push(outcome);
  },
};

function averageRating(outcome: MealOutcome): number {
  if (outcome.feedback.length === 0) return 0;
  const liked = outcome.feedback.filter((f) => f.liked).length;
  return Math.round((liked / outcome.feedback.length) * 4) + 1;
}

/** Reset process-scoped state (index/overlay). Does NOT touch XTrace — the next
 *  recall reseeds it. Used by the live smoke test. */
export function resetXtraceProcessState(): void {
  index.clear();
  revisions.clear();
  outcomes.length = 0;
  seeded = false;
  seeding = null;
  revisionSeq = 0;
}
