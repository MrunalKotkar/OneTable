import type { CheckoutResult } from "@/features/checkout/contract";
import { NoFeasibleRestaurantError } from "@/features/negotiation/contract";
import {
  feedbackFixture,
  finalRecommendationFixture,
  finalRestaurantFixture,
  sharedCheckoutItemsFixture,
} from "./demo-fixtures";
import {
  createCheckoutSession,
  payCheckout,
  prepareCheckoutFromRebalance,
  simulatePayment,
} from "./simulator";
import {
  buildMealOutcome,
  canOpenFeedback,
  canStartFulfillment,
  confirmFeedbackMemoryUpdate,
  createFulfillmentTimeline,
  deriveEtaMinutes,
} from "@/features/fulfillment/simulator";

export interface Person4AcceptanceCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export const runPerson4AsyncAcceptanceChecks = async (): Promise<
  Person4AcceptanceCheck[]
> => {
  const blockedCheckout = await prepareCheckoutFromRebalance({
    rebalance: () => {
      throw new NoFeasibleRestaurantError(
        "No safe restaurant works for every active diner.",
      );
    },
    latestApprovedVersion: finalRecommendationFixture.version,
    sharedItems: sharedCheckoutItemsFixture,
  });

  return [
    {
      id: "no-feasible-rebalance",
      label: "No feasible restaurant blocks checkout",
      passed:
        blockedCheckout.status === "blocked" &&
        blockedCheckout.reason === "no_feasible_restaurant" &&
        blockedCheckout.recommendation === null &&
        blockedCheckout.session === null,
      detail:
        blockedCheckout.status === "blocked"
          ? blockedCheckout.message
          : "Checkout incorrectly created a session.",
    },
  ];
};

const idlePayment: CheckoutResult = {
  recommendationVersion: finalRecommendationFixture.version,
  status: "idle",
};

const createStaleRecommendation = () => ({
  ...finalRecommendationFixture,
  version: finalRecommendationFixture.version - 1,
});

export const runPerson4AcceptanceChecks = (): Person4AcceptanceCheck[] => {
  const checkoutSession = createCheckoutSession({
    recommendation: finalRecommendationFixture,
    latestApprovedVersion: finalRecommendationFixture.version,
    sharedItems: sharedCheckoutItemsFixture,
    now: "2026-07-25T15:30:00.000Z",
  });
  const staleCheckoutSession = createCheckoutSession({
    recommendation: createStaleRecommendation(),
    latestApprovedVersion: finalRecommendationFixture.version,
  });
  const paidTransition = simulatePayment({ session: checkoutSession });
  const stalePayment = payCheckout({ session: staleCheckoutSession });
  const duplicatePayment = payCheckout({
    session: paidTransition.completedSession,
  });
  const timeline = createFulfillmentTimeline(
    finalRecommendationFixture,
    finalRestaurantFixture,
    "completed",
  );
  const mealOutcome = buildMealOutcome({
    groupId: "lunch-table-001",
    recommendation: finalRecommendationFixture,
    feedback: feedbackFixture,
    completedAt: "2026-07-25T16:05:00.000Z",
  });
  const memoryUpdate = confirmFeedbackMemoryUpdate({
    outcome: mealOutcome,
    savedAt: "2026-07-25T16:05:04.000Z",
  });

  let blockedEarlyFeedback = false;
  try {
    buildMealOutcome({
      groupId: "lunch-table-001",
      recommendation: finalRecommendationFixture,
      feedback: feedbackFixture,
      currentStatus: "preparing",
    });
  } catch {
    blockedEarlyFeedback = true;
  }

  const dinerTotalCents = checkoutSession.dinerCharges.reduce(
    (total, charge) => total + charge.totalCents,
    0,
  );
  const selectedDishByDiner = new Map(
    finalRecommendationFixture.selections.map((selection) => [
      selection.dinerId,
      selection.dishId,
    ]),
  );
  const feedbackMapsToSelections = mealOutcome.feedback.every(
    (entry) => selectedDishByDiner.get(entry.dinerId) === entry.dishId,
  );

  return [
    {
      id: "totals-reconcile",
      label: "Per-person totals reconcile",
      passed: dinerTotalCents === checkoutSession.groupTotalCents,
      detail: "Individual charges exactly equal the group total.",
    },
    {
      id: "stale-checkout",
      label: "Stale checkout is blocked",
      passed: stalePayment.status === "failed",
      detail: stalePayment.failureReason ?? "No stale failure reason returned.",
    },
    {
      id: "duplicate-payment",
      label: "Duplicate payment is blocked",
      passed: duplicatePayment.status === "failed",
      detail:
        duplicatePayment.failureReason ?? "No duplicate failure reason returned.",
    },
    {
      id: "payment-gates-fulfillment",
      label: "Fulfillment waits for payment",
      passed:
        !canStartFulfillment(idlePayment) &&
        canStartFulfillment(paidTransition.result),
      detail: "Only a paid checkout can start fulfillment.",
    },
    {
      id: "eta-and-statuses",
      label: "Fulfillment timeline is complete",
      passed:
        deriveEtaMinutes(finalRecommendationFixture, finalRestaurantFixture) ===
          28 &&
        timeline.length === 6 &&
        timeline.at(-1)?.status === "completed",
      detail: "ETA uses the slowest selected dish plus the fixed buffer.",
    },
    {
      id: "feedback-after-completion",
      label: "Feedback opens after completion",
      passed: canOpenFeedback("completed") && blockedEarlyFeedback,
      detail: "Feedback before completed fulfillment throws.",
    },
    {
      id: "feedback-maps-to-dishes",
      label: "Feedback maps to selected dishes",
      passed:
        mealOutcome.feedback.length ===
          finalRecommendationFixture.selections.length &&
        feedbackMapsToSelections,
      detail: "Every diner response points at their selected dish.",
    },
    {
      id: "memory-update-confirmed",
      label: "Memory update is confirmed",
      passed: memoryUpdate.status === "saved",
      detail: "The UI can show memory updated only after save confirmation.",
    },
  ];
};
