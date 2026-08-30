import { describe, expect, it } from "vitest";
import { NoFeasibleRestaurantError } from "@/features/negotiation/contract";
import {
  buildMealOutcome,
  canOpenFeedback,
  canStartFulfillment,
  confirmFeedbackMemoryUpdate,
  createFulfillmentTimeline,
  deriveEtaMinutes,
} from "@/features/fulfillment/simulator";
import {
  feedbackFixture,
  finalRecommendationFixture,
  finalRestaurantFixture,
  sharedCheckoutItemsFixture,
} from "./acceptance.fixtures";
import {
  createCheckoutSession,
  payCheckout,
  prepareCheckoutFromRebalance,
  simulatePayment,
} from "./simulator";
import type { CheckoutResult } from "./contract";

/**
 * Regression net for the money/supersession logic, ported from the
 * hand-rolled `runPerson4AcceptanceChecks`/`runPerson4AsyncAcceptanceChecks`
 * (see git history) into real `describe`/`it` blocks so later phases
 * (Phase 1+ of PRODUCTION_REBUILD_PLAN.md) have something that fails loudly
 * in CI instead of a script nobody runs.
 */
describe("checkout acceptance", () => {
  const idlePayment: CheckoutResult = {
    recommendationVersion: finalRecommendationFixture.version,
    status: "idle",
  };

  const staleRecommendation = {
    ...finalRecommendationFixture,
    version: finalRecommendationFixture.version - 1,
  };

  const checkoutSession = createCheckoutSession({
    recommendation: finalRecommendationFixture,
    latestApprovedVersion: finalRecommendationFixture.version,
    sharedItems: sharedCheckoutItemsFixture,
    now: "2026-07-25T15:30:00.000Z",
  });

  it("reconciles per-person totals against the group total", () => {
    const dinerTotalCents = checkoutSession.dinerCharges.reduce(
      (total, charge) => total + charge.totalCents,
      0,
    );
    expect(dinerTotalCents).toBe(checkoutSession.groupTotalCents);
  });

  it("blocks a stale checkout", () => {
    const staleCheckoutSession = createCheckoutSession({
      recommendation: staleRecommendation,
      latestApprovedVersion: finalRecommendationFixture.version,
    });
    const stalePayment = payCheckout({ session: staleCheckoutSession });
    expect(stalePayment.status).toBe("failed");
    expect(stalePayment.failureReason).toBeTruthy();
  });

  it("blocks a duplicate payment without flipping a completed payment to failed", () => {
    const paidTransition = simulatePayment({ session: checkoutSession });
    expect(paidTransition.result.status).toBe("paid");

    const duplicatePayment = payCheckout({
      session: paidTransition.completedSession,
    });
    expect(duplicatePayment.status).toBe("failed");
    expect(duplicatePayment.failureReason).toBeTruthy();
  });

  it("only lets a paid checkout start fulfillment", () => {
    const paidTransition = simulatePayment({ session: checkoutSession });
    expect(canStartFulfillment(idlePayment)).toBe(false);
    expect(canStartFulfillment(paidTransition.result)).toBe(true);
  });

  it("derives ETA from the slowest selected dish plus the fixed buffer, with a complete timeline", () => {
    const timeline = createFulfillmentTimeline(
      finalRecommendationFixture,
      finalRestaurantFixture,
      "completed",
    );
    expect(deriveEtaMinutes(finalRecommendationFixture, finalRestaurantFixture)).toBe(28);
    expect(timeline).toHaveLength(6);
    expect(timeline.at(-1)?.status).toBe("completed");
  });

  it("opens feedback only after fulfillment completes", () => {
    expect(canOpenFeedback("completed")).toBe(true);

    expect(() =>
      buildMealOutcome({
        groupId: "lunch-table-001",
        recommendation: finalRecommendationFixture,
        feedback: feedbackFixture,
        currentStatus: "preparing",
      }),
    ).toThrow();
  });

  it("maps every feedback entry to that diner's selected dish", () => {
    const mealOutcome = buildMealOutcome({
      groupId: "lunch-table-001",
      recommendation: finalRecommendationFixture,
      feedback: feedbackFixture,
      completedAt: "2026-07-25T16:05:00.000Z",
    });
    const selectedDishByDiner = new Map(
      finalRecommendationFixture.selections.map((selection) => [
        selection.dinerId,
        selection.dishId,
      ]),
    );

    expect(mealOutcome.feedback).toHaveLength(finalRecommendationFixture.selections.length);
    expect(
      mealOutcome.feedback.every(
        (entry) => selectedDishByDiner.get(entry.dinerId) === entry.dishId,
      ),
    ).toBe(true);
  });

  it("confirms the memory update only after save", () => {
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
    expect(memoryUpdate.status).toBe("saved");
  });

  it("blocks checkout when rebalance finds no feasible restaurant", async () => {
    const blockedCheckout = await prepareCheckoutFromRebalance({
      rebalance: () => {
        throw new NoFeasibleRestaurantError(
          "No safe restaurant works for every active diner.",
        );
      },
      latestApprovedVersion: finalRecommendationFixture.version,
      sharedItems: sharedCheckoutItemsFixture,
    });

    expect(blockedCheckout.status).toBe("blocked");
    if (blockedCheckout.status !== "blocked") throw new Error("unreachable");
    expect(blockedCheckout.reason).toBe("no_feasible_restaurant");
    expect(blockedCheckout.recommendation).toBeNull();
    expect(blockedCheckout.session).toBeNull();
  });
});
