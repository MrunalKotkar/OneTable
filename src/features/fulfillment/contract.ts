import type {
  FulfillmentStatus,
  MealOutcome,
  Recommendation,
} from "@/domain/contracts";

export interface FulfillmentSnapshot {
  status: FulfillmentStatus;
  etaMinutes: number;
}

export interface FulfillmentStep {
  status: FulfillmentStatus;
  label: string;
  etaMinutes: number;
  completed: boolean;
}

export type FeedbackMemoryStatus = "closed" | "ready" | "saving" | "saved" | "failed";

export interface FeedbackMemoryUpdate {
  status: FeedbackMemoryStatus;
  outcome: MealOutcome | null;
  savedAt: string | null;
  failureReason: string | null;
}

export interface FulfillmentGateway {
  start(recommendation: Recommendation): Promise<FulfillmentSnapshot>;
  saveFeedback(outcome: MealOutcome): Promise<void>;
}
