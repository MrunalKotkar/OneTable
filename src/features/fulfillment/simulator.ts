import type {
  DinerFeedback,
  FulfillmentStatus,
  MealOutcome,
  Recommendation,
  Restaurant,
} from "@/domain/contracts";
import type { CheckoutResult } from "@/features/checkout/contract";
import type { FeedbackMemoryUpdate, FulfillmentStep } from "./contract";

const FULFILLMENT_BUFFER_MINUTES = 8;

const labels: Record<FulfillmentStatus, string> = {
  submitted: "Submitted to MenuSifu",
  accepted: "Accepted by restaurant",
  preparing: "Kitchen is preparing",
  ready: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
};

const orderedStatuses: FulfillmentStatus[] = [
  "submitted",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
];

export const deriveEtaMinutes = (
  recommendation: Recommendation,
  restaurant: Restaurant,
) => {
  const selectedDishIds = new Set(
    recommendation.selections.map((selection) => selection.dishId),
  );
  const slowestDishMinutes = restaurant.menu
    .filter((dish) => selectedDishIds.has(dish.id))
    .reduce(
      (slowest, dish) => Math.max(slowest, dish.preparationMinutes),
      0,
    );

  return slowestDishMinutes + FULFILLMENT_BUFFER_MINUTES;
};

export const createFulfillmentTimeline = (
  recommendation: Recommendation,
  restaurant: Restaurant,
  currentStatus: FulfillmentStatus = "completed",
): FulfillmentStep[] => {
  const baseEta = deriveEtaMinutes(recommendation, restaurant);
  const currentIndex = orderedStatuses.indexOf(currentStatus);

  return orderedStatuses.map((status, index) => ({
    status,
    label: labels[status],
    etaMinutes: Math.max(baseEta - index * 4, 0),
    completed: index <= currentIndex,
  }));
};

export const canStartFulfillment = (payment: CheckoutResult) =>
  payment.status === "paid";

export const canOpenFeedback = (status: FulfillmentStatus) =>
  status === "completed";

export const buildMealOutcome = ({
  groupId,
  recommendation,
  feedback,
  completedAt = new Date().toISOString(),
  currentStatus = "completed",
}: {
  groupId: string;
  recommendation: Recommendation;
  feedback: DinerFeedback[];
  completedAt?: string;
  currentStatus?: FulfillmentStatus;
}): MealOutcome => {
  if (currentStatus !== "completed") {
    throw new Error("Feedback can only be saved after fulfillment completes.");
  }

  const selectedDinerIds = new Set(
    recommendation.selections.map((selection) => selection.dinerId),
  );
  const feedbackDinerIds = new Set(feedback.map((entry) => entry.dinerId));

  if (selectedDinerIds.size !== feedbackDinerIds.size) {
    throw new Error("Feedback must include exactly one response per diner.");
  }

  for (const selection of recommendation.selections) {
    const matchingFeedback = feedback.find(
      (entry) =>
        entry.dinerId === selection.dinerId &&
        entry.dishId === selection.dishId,
    );

    if (!matchingFeedback) {
      throw new Error("Feedback must map to the selected dish for each diner.");
    }
  }

  return {
    groupId,
    recommendationVersion: recommendation.version,
    restaurantId: recommendation.restaurantId,
    feedback,
    completedAt,
  };
};

export const createFeedbackMemoryUpdate = (
  outcome: MealOutcome | null,
  status: FeedbackMemoryUpdate["status"] = outcome ? "ready" : "closed",
): FeedbackMemoryUpdate => ({
  status,
  outcome,
  savedAt: null,
  failureReason: null,
});

export const confirmFeedbackMemoryUpdate = ({
  outcome,
  savedAt = new Date().toISOString(),
  forceFailure = false,
}: {
  outcome: MealOutcome;
  savedAt?: string;
  forceFailure?: boolean;
}): FeedbackMemoryUpdate => {
  if (forceFailure) {
    return {
      status: "failed",
      outcome,
      savedAt: null,
      failureReason: "Memory save failed in simulated fallback.",
    };
  }

  return {
    status: "saved",
    outcome,
    savedAt,
    failureReason: null,
  };
};
