import { MemoryClient } from "@xtraceai/memory";
import type {
  Belief,
  BeliefKind,
  BeliefRevision,
  DinerProfile,
  GroupContext,
  GroupMealSummary,
  MealOutcome,
} from "@/domain/contracts";
import type { MemoryGateway, ReviseBeliefInput } from "./contract";
import { demoDiners } from "@/data/demo-fixtures";

/**
 * Real XTrace-backed implementation of MemoryGateway, sitting behind the same
 * contract as mock-gateway.ts.
 *
 * XTrace does not retire contradicted facts natively (a correction leaves both
 * old and new memories active), and it stores normalized prose, not our
 * structured {kind, value} shape. So this adapter keeps its own structured
 * belief state app-side (mirroring mock-gateway's in-memory store) and uses
 * XTrace purely as the durable write/recall/delete substrate underneath it:
 * every revision ingests the correction into XTrace AND hard-deletes the
 * superseded memory's XTrace record, while the retired belief itself is kept
 * in an app-side history overlay so getBeliefHistory still works.
 */

// Constructed lazily so importing this module (which index.ts does
// unconditionally, to expose xtraceMemoryGateway alongside the mock) never
// throws for callers who haven't set XTRACE_API_KEY and are using the mock.
let _client: MemoryClient | null = null;
function client(): MemoryClient {
  if (!_client) {
    _client = new MemoryClient({ apiKey: process.env.XTRACE_API_KEY ?? "" });
  }
  return _client;
}

interface DinerState {
  profile: DinerProfile;
  /** XTrace memory id for each active belief, keyed by belief id. */
  xtraceMemoryIds: Map<string, string>;
}

const diners = new Map<string, DinerState>();
for (const diner of demoDiners) {
  const cloned = structuredClone(diner);
  diners.set(diner.id, {
    profile: cloned,
    xtraceMemoryIds: new Map(),
  });
}

const outcomes: MealOutcome[] = [];

/** History overlay: retired belief per (dinerId, kind), same pattern as mock-gateway. */
const history = new Map<string, BeliefRevision>();
let revisionSeq = 0;

function historyKey(dinerId: string, kind: BeliefKind): string {
  return `${dinerId}:${kind}`;
}

function activeBeliefs(profile: DinerProfile): Belief[] {
  return profile.beliefs.filter((b) => b.status === "active");
}

/** Same supersession rule as mock-gateway's pickSupersededBelief. */
function pickSupersededBelief(active: Belief[], kind: BeliefKind): Belief | null {
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

function averageRating(outcome: MealOutcome): number {
  if (outcome.feedback.length === 0) return 0;
  const liked = outcome.feedback.filter((f) => f.liked).length;
  return Math.round((liked / outcome.feedback.length) * 4) + 1;
}

export const xtraceMemoryGateway: MemoryGateway = {
  async recallGroupContext(
    groupId: string,
    dinerIds: string[],
    intent: string,
  ): Promise<GroupContext> {
    // XTrace search is consulted per diner so the underlying facts are
    // actually durable/queryable there, but the structured belief list
    // returned to the caller comes from our own app-side state — XTrace
    // doesn't hand back {kind, value}, only normalized prose.
    for (const dinerId of dinerIds) {
      const state = diners.get(dinerId);
      if (!state) continue;
      await client().memories.search({ query: intent, user_id: dinerId });
    }

    const resolved = dinerIds
      .map((id) => diners.get(id))
      .filter((s): s is DinerState => s !== undefined)
      .map((s) => ({
        ...s.profile,
        beliefs: activeBeliefs(s.profile),
      }));

    const groupHistory: GroupMealSummary[] = outcomes
      .filter((o) => o.groupId === groupId)
      .map((o) => ({
        restaurant: o.restaurantId,
        occurredAt: o.completedAt,
        rating: averageRating(o),
      }));

    return { groupId, intent, diners: resolved, history: groupHistory };
  },

  async reviseBelief(input: ReviseBeliefInput): Promise<BeliefRevision> {
    const state = diners.get(input.dinerId);
    if (!state) {
      throw new Error(`Unknown diner: ${input.dinerId}`);
    }

    const active = activeBeliefs(state.profile);
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

    // Ingest the correction into XTrace. conv_id is synthesized: our domain
    // model has no notion of a "conversation", but XTrace requires one per
    // ingest. wait:true so the memory id is available inline instead of
    // requiring a job poll.
    const job = await client().memories.ingest(
      {
        messages: [{ role: "user", content: input.correctionText }],
        user_id: input.dinerId,
        conv_id: `${input.dinerId}-${input.kind}-${now}`,
      },
      { wait: true },
    );

    const createdId = job.result?.memories_created[0]?.id;
    if (createdId) {
      state.xtraceMemoryIds.set(current.id, createdId);
    }

    // Hard-delete the superseded belief's XTrace record, per the documented
    // design — XTrace never sees two active facts for the same constraint.
    if (previousMatch) {
      const oldMemoryId = state.xtraceMemoryIds.get(previousMatch.id);
      if (oldMemoryId) {
        await client().memories.delete(oldMemoryId);
        state.xtraceMemoryIds.delete(previousMatch.id);
      }
    }

    const nextBeliefs = state.profile.beliefs.map((b) =>
      previousMatch && b.id === previousMatch.id
        ? { ...b, status: "superseded" as const, updatedAt: now }
        : b,
    );
    nextBeliefs.push(current);
    state.profile.beliefs = nextBeliefs;

    const revision: BeliefRevision = {
      dinerId: input.dinerId,
      previous: { ...previous, status: "superseded" },
      current,
    };
    history.set(historyKey(input.dinerId, input.kind), revision);
    return revision;
  },

  async getBeliefHistory(
    dinerId: string,
    kind: BeliefKind,
  ): Promise<BeliefRevision | null> {
    return history.get(historyKey(dinerId, kind)) ?? null;
  },

  async saveMealOutcome(outcome: MealOutcome): Promise<void> {
    outcomes.push(outcome);

    const dinerIds = [...new Set(outcome.feedback.map((f) => f.dinerId))];
    const summary = `Group ${outcome.groupId} ate at ${outcome.restaurantId} (recommendation v${outcome.recommendationVersion}). Feedback: ${outcome.feedback
      .map((f) => `${f.dinerId} ${f.liked ? "liked" : "disliked"} ${f.dishId}`)
      .join(", ")}.`;

    for (const dinerId of dinerIds) {
      await client().memories.ingest(
        {
          messages: [{ role: "user", content: summary }],
          user_id: dinerId,
          conv_id: `${outcome.groupId}-outcome-${outcome.completedAt}`,
        },
        { wait: true },
      );
    }
  },
};
