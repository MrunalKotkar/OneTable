import type { FulfillmentStatus, PaymentStatus } from "@/domain/contracts";
import type { Phase } from "@/lib/phase";

/**
 * Elapsed-time phase/fulfillment derivation (Phase 4 of
 * PRODUCTION_REBUILD_PLAN.md), replacing the old setTimeout-driven
 * mutation chains, which cannot survive a serverless function returning on
 * Vercel.
 *
 * The approach: every action handler in table-store.ts does its real work
 * (recall, rebalance, belief revision, payment) *immediately*, in the same
 * request, and writes the true outcome to the DB right away — there is
 * never a moment where the stored `phase`/payment status is wrong or
 * pending. What these pure functions add is a purely cosmetic "reveal
 * delay": the same transitional phases the original demo pacing showed
 * ("recalling" -> "negotiating" -> ...), computed from elapsed time on
 * every read rather than scheduled. If nobody ever polled during the
 * window, nothing is lost — the next read just shows the real terminal
 * state directly.
 */

export type PendingAction = "create" | "join" | "revise";

interface Milestone {
  offsetMs: number;
  phase: Phase;
}

/** Mirrors the original demo pacing in table-store.ts's now-deleted setTimeout chains. */
const MILESTONES: Record<PendingAction, Milestone[]> = {
  create: [
    { offsetMs: 0, phase: "recalling" },
    { offsetMs: 600, phase: "negotiating" },
  ],
  join: [
    { offsetMs: 0, phase: "recalling" },
    { offsetMs: 400, phase: "rebalancing" },
  ],
  revise: [
    { offsetMs: 0, phase: "revising_belief" },
    { offsetMs: 550, phase: "recalling" },
    { offsetMs: 950, phase: "rebalancing" },
  ],
};

/** How long after actionStartedAt the transitional display resolves to the real, already-settled phase. */
const ACTION_TOTAL_MS: Record<PendingAction, number> = {
  create: 1300,
  join: 1050,
  revise: 1600,
};

/**
 * The phase to display right now. `realPhase` is always the true,
 * already-computed answer; while `now` is still inside the pending
 * action's reveal window, a transitional phase is shown instead.
 */
export function deriveDisplayPhase(
  realPhase: Phase,
  pendingAction: PendingAction | null,
  actionStartedAt: Date | null,
  now: Date,
): Phase {
  if (!pendingAction || !actionStartedAt) return realPhase;

  const elapsedMs = now.getTime() - actionStartedAt.getTime();
  if (elapsedMs >= ACTION_TOTAL_MS[pendingAction]) return realPhase;

  const milestones = MILESTONES[pendingAction];
  let current = milestones[0].phase;
  for (const milestone of milestones) {
    if (elapsedMs >= milestone.offsetMs) current = milestone.phase;
  }
  return current;
}

const FULFILLMENT_STEPS: { offsetMs: number; status: FulfillmentStatus }[] = [
  { offsetMs: 0, status: "submitted" },
  { offsetMs: 900, status: "accepted" },
  { offsetMs: 1800, status: "preparing" },
  { offsetMs: 2700, status: "ready" },
  { offsetMs: 3600, status: "out_for_delivery" },
  { offsetMs: 4500, status: "completed" },
];

/** Purely a function of `paidAt` — there is no stored per-step fulfillment column at all. */
export function deriveFulfillmentStatus(
  paidAt: Date | null,
  now: Date,
): FulfillmentStatus | null {
  if (!paidAt) return null;
  const elapsedMs = now.getTime() - paidAt.getTime();

  let current: FulfillmentStatus = FULFILLMENT_STEPS[0].status;
  for (const step of FULFILLMENT_STEPS) {
    if (elapsedMs >= step.offsetMs) current = step.status;
  }
  return current;
}

const PAYMENT_PROCESSING_MS = 700;

/**
 * The same reveal-delay trick for a single payment attempt: the row
 * already holds its real, final status the moment payForTable() writes
 * it, but the UI briefly shows "processing" first, same as the original
 * demo pacing did with a scheduled mutation.
 */
export function derivePaymentDisplayStatus(
  realStatus: PaymentStatus,
  attemptStartedAt: Date,
  now: Date,
): PaymentStatus {
  if (realStatus !== "paid" && realStatus !== "failed") return realStatus;
  const elapsedMs = now.getTime() - attemptStartedAt.getTime();
  return elapsedMs >= PAYMENT_PROCESSING_MS ? realStatus : "processing";
}
