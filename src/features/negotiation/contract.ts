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

export interface NegotiationEngine {
  rebalance(input: RebalanceInput): Promise<Recommendation>;
}

