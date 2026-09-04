import type {
  Belief,
  Dish,
  DinerProfile,
  DinerSelection,
  GroupContext,
  Recommendation,
  RecommendationChange,
  Restaurant,
} from "@/domain/contracts";
import type { NegotiationEngine, RebalanceInput } from "./contract";
import { NoFeasibleRestaurantError } from "./contract";

export { NoFeasibleRestaurantError };

const activeBeliefs = (diner: DinerProfile): Belief[] =>
  diner.beliefs.filter((belief) => belief.status === "active");

export function isDishSafe(dish: Dish, diner: DinerProfile): boolean {
  if (!dish.available) return false;

  for (const belief of activeBeliefs(diner)) {
    switch (belief.kind) {
      case "allergy": {
        if (dish.allergenStatus === "unknown") return false;
        if (dish.allergens.includes(String(belief.value))) return false;
        break;
      }
      case "diet": {
        const diet = String(belief.value);
        if (diet === "no dietary restrictions") break;
        if (!dish.tags.includes(diet)) return false;
        break;
      }
      case "budget": {
        const budget = Number(belief.value);
        if (dish.price > budget) return false;
        break;
      }
      default:
        break;
    }
  }

  return true;
}

export function isRestaurantFeasible(
  restaurant: Restaurant,
  diners: DinerProfile[]
): boolean {
  return diners.every((diner) =>
    restaurant.menu.some((dish) => isDishSafe(dish, diner))
  );
}

function goalTags(diner: DinerProfile): string[] {
  return activeBeliefs(diner)
    .filter((belief) => belief.kind === "goal")
    .map((belief) => String(belief.value))
    .map((value) => (value === "high protein" ? "high-protein" : value));
}

export function scoreRestaurant(
  restaurant: Restaurant,
  context: GroupContext
): number {
  let score = 0;

  for (const diner of context.diners) {
    const safeDishes = restaurant.menu.filter((dish) =>
      isDishSafe(dish, diner)
    );
    if (safeDishes.length === 0) continue;

    // Reward having more safe options per diner (capped), not just "at
    // least one" — this is what lets allergy/diet constraints (which don't
    // map to a budget/goal belief) actually influence which restaurant
    // wins, without letting a tiny fully-safe menu (e.g. 2 dishes) beat a
    // larger menu with more absolute choice.
    //
    // Cap raised from 3 to 5: at 3, a diner going from 5 safe dishes to 4
    // (e.g. Jordan losing exactly one shellfish dish to a new allergy)
    // rounds to the same capped value both before and after, so the
    // revision has literally no way to move a restaurant's score. That
    // silently broke the demo's central belief-revision rebalance (v2 -> v3
    // produced zero visible change). 5 covers every menu size in the demo
    // catalog, so real per-diner differences can actually surface.
    score += Math.min(safeDishes.length, 5) * 0.5;

    const budgetBelief = activeBeliefs(diner).find(
      (belief) => belief.kind === "budget"
    );
    if (budgetBelief) {
      const budget = Number(budgetBelief.value);
      const cheapest = Math.min(...safeDishes.map((dish) => dish.price));
      if (cheapest <= budget) score += 2;
    }

    const goals = goalTags(diner);
    if (
      goals.length > 0 &&
      safeDishes.some((dish) => goals.some((goal) => dish.tags.includes(goal)))
    ) {
      score += 2;
    }
  }

  const historyHit = context.history.some(
    (entry) => entry.restaurant === restaurant.id
  );
  if (historyHit) score += 0.8;

  const varietyBonus = Math.min(restaurant.menu.length, 5) * 0.1;
  score += varietyBonus;

  return score;
}

function isLikedPastOrder(diner: DinerProfile, dish: Dish, restaurant: Restaurant): boolean {
  return diner.pastOrders.some(
    (order) =>
      order.liked && order.restaurant === restaurant.id && order.dish === dish.name
  );
}

export function selectDish(diner: DinerProfile, restaurant: Restaurant): Dish {
  const safeDishes = restaurant.menu.filter((dish) => isDishSafe(dish, diner));
  if (safeDishes.length === 0) {
    throw new NoFeasibleRestaurantError(
      `No safe dish for diner "${diner.id}" at "${restaurant.name}".`,
    );
  }

  const goals = goalTags(diner);

  let best = safeDishes[0];
  let bestMatches = -1;
  let bestLiked = false;

  for (const dish of safeDishes) {
    const matches = dish.tags.filter((tag) => goals.includes(tag)).length;
    const liked = isLikedPastOrder(diner, dish, restaurant);

    if (matches > bestMatches || (matches === bestMatches && liked && !bestLiked)) {
      bestMatches = matches;
      bestLiked = liked;
      best = dish;
    }
  }

  return best;
}

export function buildExplanation(diner: DinerProfile, dish: Dish): string {
  return `${dish.name} — safe for ${diner.name} and fits the budget`;
}

export function diffRecommendations(
  prev: Recommendation | undefined,
  next: Recommendation,
  diners: DinerProfile[],
  restaurants: Restaurant[],
): RecommendationChange[] {
  if (!prev) return [];

  const changes: RecommendationChange[] = [];

  // Names, not raw ids, in the summaries shown to diners. Falls back to the
  // id itself if a lookup misses (e.g. a diner who's since left the table,
  // or a restaurant no longer in the candidate list) rather than throwing.
  const dinerName = (id: string) => diners.find((d) => d.id === id)?.name ?? id;
  const restaurantName = (id: string) => restaurants.find((r) => r.id === id)?.name ?? id;
  const dishName = (id: string) =>
    restaurants.flatMap((r) => r.menu).find((dish) => dish.id === id)?.name ?? id;

  if (prev.restaurantId !== next.restaurantId) {
    changes.push({
      kind: "restaurant",
      summary: `Restaurant changed from ${restaurantName(prev.restaurantId)} to ${restaurantName(next.restaurantId)}`,
    });
  }

  const prevByDiner = new Map(
    prev.selections.map((selection) => [selection.dinerId, selection])
  );
  const nextByDiner = new Map(
    next.selections.map((selection) => [selection.dinerId, selection])
  );

  for (const [dinerId, nextSelection] of nextByDiner) {
    const prevSelection = prevByDiner.get(dinerId);
    if (!prevSelection) {
      changes.push({
        kind: "member",
        summary: `${dinerName(dinerId)} joined the order`,
      });
      continue;
    }
    if (prevSelection.dishId !== nextSelection.dishId) {
      changes.push({
        kind: "dish",
        summary: `${dinerName(dinerId)}'s dish changed from ${dishName(prevSelection.dishId)} to ${dishName(nextSelection.dishId)}`,
      });
    }
    if (prevSelection.price !== nextSelection.price) {
      changes.push({
        kind: "price",
        summary: `${dinerName(dinerId)}'s price changed from $${prevSelection.price} to $${nextSelection.price}`,
      });
    }
  }

  for (const dinerId of prevByDiner.keys()) {
    if (!nextByDiner.has(dinerId)) {
      changes.push({
        kind: "member",
        summary: `${dinerName(dinerId)} left the order`,
      });
    }
  }

  return changes;
}

export class RuleBasedNegotiationEngine implements NegotiationEngine {
  async rebalance(input: RebalanceInput): Promise<Recommendation> {
    const { context, restaurants, previousRecommendation } = input;

    const feasible = restaurants.filter((restaurant) =>
      isRestaurantFeasible(restaurant, context.diners)
    );

    if (feasible.length === 0) {
      throw new NoFeasibleRestaurantError(
        `No feasible restaurant found for group "${context.groupId}".`,
      );
    }

    let bestRestaurant = feasible[0];
    let bestScore = scoreRestaurant(bestRestaurant, context);

    for (const restaurant of feasible.slice(1)) {
      const score = scoreRestaurant(restaurant, context);
      if (score > bestScore) {
        bestScore = score;
        bestRestaurant = restaurant;
      }
    }

    const selections: DinerSelection[] = context.diners.map((diner) => {
      const dish = selectDish(diner, bestRestaurant);
      return {
        dinerId: diner.id,
        dishId: dish.id,
        price: dish.price,
        reason: buildExplanation(diner, dish),
      };
    });

    const total = selections.reduce((sum, selection) => sum + selection.price, 0);
    const etaMinutes = Math.max(
      ...bestRestaurant.menu
        .filter((dish) =>
          selections.some((selection) => selection.dishId === dish.id)
        )
        .map((dish) => dish.preparationMinutes)
    );

    const alternativeRestaurantId =
      feasible.find((restaurant) => restaurant.id !== bestRestaurant.id)?.id ??
      null;

    const explanation = selections
      .map((selection) => selection.reason)
      .join("; ");

    const next: Recommendation = {
      version: (previousRecommendation?.version ?? 0) + 1,
      restaurantId: bestRestaurant.id,
      selections,
      total,
      etaMinutes,
      explanation,
      alternativeRestaurantId,
      changes: [],
    };

    next.changes = diffRecommendations(previousRecommendation, next, context.diners, restaurants);

    return next;
  }
}
