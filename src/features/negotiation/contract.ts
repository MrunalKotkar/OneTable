import type {
  GroupContext,
  Recommendation,
  Restaurant,
} from "@/domain/contracts";

export interface RebalanceInput {
  context: GroupContext;
  restaurants: Restaurant[];
  previousRecommendation?: Recommendation;
}

export class NoFeasibleRestaurantError extends Error {
  constructor(message = "No restaurant can safely serve every active diner.") {
    super(message);
    this.name = "NoFeasibleRestaurantError";
  }
}

export interface NegotiationEngine {
  rebalance(input: RebalanceInput): Promise<Recommendation>;
}
