import type {
  FulfillmentStatus,
  MealOutcome,
  Recommendation,
} from "@/domain/contracts";

export interface FulfillmentSnapshot {
  status: FulfillmentStatus;
  etaMinutes: number;
}

export interface FulfillmentGateway {
  start(recommendation: Recommendation): Promise<FulfillmentSnapshot>;
  saveFeedback(outcome: MealOutcome): Promise<void>;
}

