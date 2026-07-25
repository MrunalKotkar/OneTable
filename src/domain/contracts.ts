export type BeliefStatus = "active" | "superseded";

export type BeliefKind =
  | "allergy"
  | "diet"
  | "budget"
  | "goal"
  | "preference"
  | "dislike";

export interface Belief {
  id: string;
  kind: BeliefKind;
  value: string | number;
  status: BeliefStatus;
  updatedAt: string;
  supersedes: string | null;
}

export interface PastOrder {
  restaurant: string;
  dish: string;
  liked: boolean;
}

export interface DinerProfile {
  id: string;
  name: string;
  initials: string;
  beliefs: Belief[];
  pastOrders: PastOrder[];
}

export interface Dish {
  id: string;
  name: string;
  price: number;
  tags: string[];
  allergens: string[];
  allergenStatus: "verified" | "unknown";
  preparationMinutes: number;
  available: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  menu: Dish[];
}

export interface GroupContext {
  groupId: string;
  intent: string;
  diners: DinerProfile[];
  history: GroupMealSummary[];
}

export interface GroupMealSummary {
  restaurant: string;
  occurredAt: string;
  rating: number;
}

export interface DinerSelection {
  dinerId: string;
  dishId: string;
  price: number;
  reason: string;
}

export interface RecommendationChange {
  kind: "restaurant" | "dish" | "member" | "belief" | "price";
  summary: string;
}

export interface Recommendation {
  version: number;
  restaurantId: string;
  selections: DinerSelection[];
  total: number;
  etaMinutes: number;
  explanation: string;
  alternativeRestaurantId: string | null;
  changes: RecommendationChange[];
}

export interface BeliefRevision {
  dinerId: string;
  previous: Belief;
  current: Belief;
}

export interface DinerFeedback {
  dinerId: string;
  dishId: string;
  liked: boolean;
  note?: string;
}

export interface MealOutcome {
  groupId: string;
  recommendationVersion: number;
  restaurantId: string;
  feedback: DinerFeedback[];
  completedAt: string;
}

export type PaymentStatus =
  | "idle"
  | "processing"
  | "paid"
  | "failed";

export type FulfillmentStatus =
  | "submitted"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed";

