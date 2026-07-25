import type {
  BeliefRevision,
  DinerFeedback,
  DinerProfile,
  FulfillmentStatus,
  GroupMealSummary,
  Recommendation,
} from "@/domain/contracts";
import {
  buildJordanRevision,
  demoDiners,
  demoGroupHistory,
  demoRestaurants,
  recommendationV1,
  recommendationV2,
  recommendationV3,
} from "@/data/demo-fixtures";
import type { Phase } from "@/lib/phase";
import type { CheckoutResult, CheckoutSession } from "@/features/checkout/contract";
import { createCheckoutSession, simulatePayment } from "@/features/checkout/simulator";
import type { FeedbackMemoryUpdate, FulfillmentStep } from "@/features/fulfillment/contract";
import {
  buildMealOutcome,
  confirmFeedbackMemoryUpdate,
  createFulfillmentTimeline,
} from "@/features/fulfillment/simulator";

/**
 * Stand-in shared backend for the hackathon demo: an in-memory store on
 * the Next.js server process. This is what makes "share a table link and
 * have someone else join from their own device" possible at all, since
 * plain client-side React state can't be seen across devices.
 *
 * This is NOT Person 1's MemoryGateway or Person 2's NegotiationEngine —
 * it is a temporary, single-process, non-persistent stand-in (state is
 * lost on server restart, and this will misbehave if the app is ever
 * deployed across multiple server instances). It exists only so the
 * multi-device join/negotiate/revise story can be demoed end to end
 * before those real features exist.
 */

export interface TableState {
  id: string;
  intent: string;
  seatedDinerIds: string[];
  phase: Phase;
  recommendation: Recommendation | null;
  previousRecommendation: Recommendation | null;
  revision: BeliefRevision | null;
  errorMessage: string | null;
  approved: boolean;
  approvedVersion: number | null;
  checkout: CheckoutSession | null;
  lastPaymentResult: CheckoutResult | null;
  fulfillmentStatus: FulfillmentStatus | null;
  feedback: DinerFeedback[];
  memoryUpdate: FeedbackMemoryUpdate | null;
  updatedAt: number;
}

export interface TableSnapshot extends TableState {
  diners: DinerProfile[];
  fulfillmentTimeline: FulfillmentStep[] | null;
}

const diners = new Map<string, DinerProfile>();
const tables = new Map<string, TableState>();
let groupHistory: GroupMealSummary[] = [];

function seedDiners(): void {
  diners.clear();
  for (const diner of demoDiners) {
    diners.set(diner.id, {
      ...diner,
      beliefs: diner.beliefs.map((belief) => ({ ...belief })),
    });
  }
}

function seedHistory(): void {
  groupHistory = demoGroupHistory.map((meal) => ({ ...meal }));
}

seedDiners();
seedHistory();

function makeTableId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function schedule(id: string, delayMs: number, mutate: (table: TableState) => void): void {
  setTimeout(() => {
    const table = tables.get(id);
    if (!table) return;
    mutate(table);
    table.updatedAt = Date.now();
  }, delayMs);
}

function resolveDiners(ids: string[]): DinerProfile[] {
  return ids.map((id) => diners.get(id)).filter((d): d is DinerProfile => Boolean(d));
}

export function createTable(intent: string): TableState {
  const id = makeTableId();
  const table: TableState = {
    id,
    intent,
    seatedDinerIds: ["alex", "sam", "jordan"],
    phase: "recalling",
    recommendation: null,
    previousRecommendation: null,
    revision: null,
    errorMessage: null,
    approved: false,
    approvedVersion: null,
    checkout: null,
    lastPaymentResult: null,
    fulfillmentStatus: null,
    feedback: [],
    memoryUpdate: null,
    updatedAt: Date.now(),
  };
  tables.set(id, table);

  schedule(id, 600, (t) => {
    t.phase = "negotiating";
  });
  schedule(id, 1300, (t) => {
    t.recommendation = { ...recommendationV1, changes: [] };
    t.phase = "ready";
  });

  return table;
}

/**
 * A diner opens the shared link and claims their seat. Idempotent for
 * diners already seated. Only Priya joining after the first
 * recommendation triggers the scripted rebalance (v1 -> v2) — this
 * mirrors docs/TEAM_PLAN.md's "Priya joins" story, which is the only
 * membership change the fixed fixtures model.
 */
export function joinTable(id: string, dinerId: string): TableState | null {
  const table = tables.get(id);
  if (!table) return null;
  if (table.approved) return table;
  if (!diners.has(dinerId)) return table;
  if (table.seatedDinerIds.includes(dinerId)) return table;

  table.seatedDinerIds = [...table.seatedDinerIds, dinerId];
  table.updatedAt = Date.now();

  if (dinerId === "priya" && table.recommendation?.version === 1) {
    table.phase = "recalling";
    schedule(id, 400, (t) => {
      t.phase = "rebalancing";
    });
    schedule(id, 1050, (t) => {
      t.previousRecommendation = t.recommendation;
      t.recommendation = recommendationV2;
      t.phase = "ready";
    });
  }

  return table;
}

/**
 * Jordan corrects his own belief from his own device. Updates the
 * shared diner record (so it persists for anyone who looks him up
 * later, independent of this table) and triggers the scripted
 * rebalance to v3.
 */
export function reviseJordanBelief(id: string): TableState | null {
  const table = tables.get(id);
  if (!table) return null;
  if (table.approved) return table;
  if (!table.seatedDinerIds.includes("jordan")) return table;
  if (table.revision) return table;

  table.phase = "revising_belief";
  table.updatedAt = Date.now();

  schedule(id, 550, (t) => {
    const revision = buildJordanRevision(new Date().toISOString());
    diners.set("jordan", {
      ...diners.get("jordan")!,
      beliefs: [{ ...revision.previous }, { ...revision.current }],
    });
    t.revision = revision;
    t.phase = "recalling";
  });
  schedule(id, 950, (t) => {
    t.phase = "rebalancing";
  });
  schedule(id, 1600, (t) => {
    t.previousRecommendation = t.recommendation;
    t.recommendation = recommendationV3;
    t.phase = "ready";
  });

  return table;
}

/**
 * Approving locks the table: no further joins or belief revisions, and
 * the recommendation version at this moment becomes the only one
 * checkout will accept. Errors here are reported via a discriminated
 * return rather than a thrown exception, since API routes need to map
 * "not ready yet" to a 409 without a try/catch at every call site.
 */
export function approveTable(id: string): { ok: true; table: TableState } | { ok: false; reason: string } {
  const table = tables.get(id);
  if (!table) return { ok: false, reason: "Table not found." };
  if (table.phase !== "ready" || !table.recommendation) {
    return { ok: false, reason: "No ready recommendation to approve yet." };
  }
  table.approved = true;
  table.approvedVersion = table.recommendation.version;
  table.updatedAt = Date.now();
  return { ok: true, table };
}

function restaurantFor(recommendation: Recommendation) {
  return demoRestaurants.find((r) => r.id === recommendation.restaurantId) ?? null;
}

/**
 * Creates the checkout session from the table's approved recommendation
 * — never from a hardcoded fixture — so the split always matches what
 * this specific group actually negotiated.
 */
export function startCheckout(id: string): { ok: true; table: TableState } | { ok: false; reason: string } {
  const table = tables.get(id);
  if (!table) return { ok: false, reason: "Table not found." };
  if (!table.approved || !table.recommendation || table.approvedVersion === null) {
    return { ok: false, reason: "Approve a recommendation before checkout." };
  }
  if (table.checkout) return { ok: true, table };

  const session = createCheckoutSession({
    recommendation: table.recommendation,
    latestApprovedVersion: table.approvedVersion,
  });

  // Person 4's simulator labels "main" line items with the raw dishId
  // (it has no restaurant to resolve names against). Relabel with the
  // actual dish name here, since we do have the restaurant.
  const restaurant = restaurantFor(table.recommendation);
  if (restaurant) {
    const dishNameById = new Map(restaurant.menu.map((dish) => [dish.id, dish.name]));
    session.dinerCharges = session.dinerCharges.map((charge) => ({
      ...charge,
      lineItems: charge.lineItems.map((item) =>
        item.kind === "main" && dishNameById.has(item.label)
          ? { ...item, label: dishNameById.get(item.label)! }
          : item,
      ),
    }));
  }

  table.checkout = session;
  table.updatedAt = Date.now();
  return { ok: true, table };
}

/**
 * Simulates payment. "Processing" is set immediately so pollers see it,
 * then the real transition lands shortly after (matching the rest of
 * this store's phase-timing feel).
 *
 * Guards against a quirk in Person 4's simulatePayment: its failCheckout
 * helper forces the returned session to status "failed" even for the
 * "already paid" / "already processing" rejection branches. Applying
 * that blindly would let a duplicate Pay click flip a genuinely
 * completed payment back to "failed". So once a session has already
 * settled (paid or mid-processing), we keep it as the source of truth
 * and only surface the rejection result — we never overwrite it.
 */
export function payForTable(
  id: string,
  options?: { forceFailure?: boolean },
): { ok: true; table: TableState } | { ok: false; reason: string } {
  const table = tables.get(id);
  if (!table) return { ok: false, reason: "Table not found." };
  if (!table.checkout) return { ok: false, reason: "Start checkout before paying." };

  const alreadySettled = table.checkout.status === "paid" || table.checkout.status === "processing";

  if (alreadySettled) {
    // Duplicate/late attempt on a session that already reflects the true
    // state: report the rejection synchronously and leave the stored
    // session completely untouched — never route this through the
    // "processing" mutation below, which would otherwise stamp over it.
    const transition = simulatePayment({ session: table.checkout });
    table.lastPaymentResult = transition.result;
    table.updatedAt = Date.now();
    return { ok: true, table };
  }

  const sessionForAttempt = table.checkout;
  table.checkout = { ...table.checkout, status: "processing" };
  table.updatedAt = Date.now();

  schedule(id, 700, (t) => {
    const transition = simulatePayment({
      session: sessionForAttempt,
      forceFailure: options?.forceFailure,
    });
    t.checkout = transition.completedSession;
    t.lastPaymentResult = transition.result;

    if (transition.result.status === "paid") {
      t.fulfillmentStatus = "submitted";
      const restaurant = t.recommendation ? restaurantFor(t.recommendation) : null;
      if (restaurant && t.recommendation) {
        const steps: FulfillmentStatus[] = [
          "accepted",
          "preparing",
          "ready",
          "out_for_delivery",
          "completed",
        ];
        steps.forEach((status, index) => {
          schedule(id, 900 * (index + 1), (tt) => {
            tt.fulfillmentStatus = status;
          });
        });
      }
    }
  });

  return { ok: true, table };
}

/**
 * One diner submits their own feedback. Only allowed once fulfillment
 * has completed. Once every seated diner has responded, builds the
 * MealOutcome and writes it back into shared memory: appended to group
 * history and to each diner's own pastOrders, so a later fresh-session
 * lookup actually reflects it.
 */
export function submitFeedback(
  id: string,
  dinerId: string,
  liked: boolean,
  note?: string,
): { ok: true; table: TableState } | { ok: false; reason: string } {
  const table = tables.get(id);
  if (!table) return { ok: false, reason: "Table not found." };
  if (table.fulfillmentStatus !== "completed") {
    return { ok: false, reason: "Feedback opens once fulfillment is completed." };
  }
  if (!table.seatedDinerIds.includes(dinerId)) {
    return { ok: false, reason: "This diner is not at the table." };
  }
  const selection = table.recommendation?.selections.find((s) => s.dinerId === dinerId);
  if (!selection) return { ok: false, reason: "No selection on file for this diner." };

  const withoutExisting = table.feedback.filter((f) => f.dinerId !== dinerId);
  table.feedback = [...withoutExisting, { dinerId, dishId: selection.dishId, liked, note }];
  table.updatedAt = Date.now();

  const allResponded = table.seatedDinerIds.every((seatedId) =>
    table.feedback.some((f) => f.dinerId === seatedId),
  );

  if (allResponded && table.recommendation && !table.memoryUpdate) {
    const completedAt = new Date().toISOString();
    const outcome = buildMealOutcome({
      groupId: id,
      recommendation: table.recommendation,
      feedback: table.feedback,
      completedAt,
      currentStatus: table.fulfillmentStatus,
    });
    table.memoryUpdate = confirmFeedbackMemoryUpdate({ outcome, savedAt: completedAt });

    const restaurant = restaurantFor(table.recommendation);
    if (restaurant) {
      const likedCount = table.feedback.filter((f) => f.liked).length;
      const rating = Math.max(1, Math.round((likedCount / table.feedback.length) * 5));
      groupHistory = [...groupHistory, { restaurant: restaurant.name, occurredAt: completedAt, rating }];

      for (const entry of table.feedback) {
        const diner = diners.get(entry.dinerId);
        const dish = restaurant.menu.find((d) => d.id === entry.dishId);
        if (!diner || !dish) continue;
        diners.set(entry.dinerId, {
          ...diner,
          pastOrders: [...diner.pastOrders, { restaurant: restaurant.name, dish: dish.name, liked: entry.liked }],
        });
      }
    }
  }

  return { ok: true, table };
}

export function getTable(id: string): TableSnapshot | null {
  const table = tables.get(id);
  if (!table) return null;
  const restaurant = table.recommendation ? restaurantFor(table.recommendation) : null;
  const fulfillmentTimeline =
    table.recommendation && restaurant && table.fulfillmentStatus
      ? createFulfillmentTimeline(table.recommendation, restaurant, table.fulfillmentStatus)
      : null;
  return {
    ...table,
    diners: resolveDiners(table.seatedDinerIds),
    fulfillmentTimeline,
  };
}

export function getAllDinerProfiles(): DinerProfile[] {
  return demoDiners.map((seed) => diners.get(seed.id) ?? seed);
}

export function getDinerProfile(id: string): DinerProfile | null {
  return diners.get(id) ?? null;
}

export function getGroupHistory(): GroupMealSummary[] {
  return groupHistory;
}

/** Demo-rehearsal reset: clears every table and restores seed beliefs. */
export function resetAll(): void {
  seedDiners();
  seedHistory();
  tables.clear();
}
