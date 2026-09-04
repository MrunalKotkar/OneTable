import { describe, expect, it } from "vitest";
import type { DinerProfile, Recommendation, Restaurant } from "@/domain/contracts";
import { diffRecommendations } from "./engine";

/**
 * Regression test: diffRecommendations used to interpolate raw dinerId/
 * dishId/restaurantId straight into the "What changed" summaries shown on
 * the table page — a real user caught this in production ("here instead
 * of the ID - name should be seen"). Names now come from the diners/
 * restaurants passed alongside the recommendations being diffed.
 */
const alex: DinerProfile = {
  id: "alex-uuid",
  name: "Alex",
  initials: "AL",
  beliefs: [],
  pastOrders: [],
};

const noodleRepublic: Restaurant = {
  id: "noodle-republic",
  name: "Noodle Republic",
  cuisine: "Pan-Asian",
  menu: [{ id: "nr-pad-thai", name: "Classic Pad Thai", price: 13, tags: [], allergens: [], allergenStatus: "verified", preparationMinutes: 14, available: true }],
};

const harborAndVine: Restaurant = {
  id: "harbor-and-vine",
  name: "Harbor & Vine",
  cuisine: "Seafood & Grill",
  menu: [{ id: "hv-shrimp-scampi", name: "Garlic Butter Shrimp Scampi", price: 19, tags: [], allergens: [], allergenStatus: "verified", preparationMinutes: 18, available: true }],
};

const restaurants = [noodleRepublic, harborAndVine];

function recommendation(overrides: Partial<Recommendation>): Recommendation {
  return {
    version: 1,
    restaurantId: noodleRepublic.id,
    selections: [{ dinerId: alex.id, dishId: "nr-pad-thai", price: 13, reason: "test" }],
    total: 13,
    etaMinutes: 20,
    explanation: "test",
    alternativeRestaurantId: null,
    changes: [],
    ...overrides,
  };
}

describe("diffRecommendations", () => {
  it("names the restaurant and dish, not their ids", () => {
    const prev = recommendation({});
    const next = recommendation({
      version: 2,
      restaurantId: harborAndVine.id,
      selections: [{ dinerId: alex.id, dishId: "hv-shrimp-scampi", price: 19, reason: "test" }],
    });

    const changes = diffRecommendations(prev, next, [alex], restaurants);
    const summaries = changes.map((c) => c.summary);

    expect(summaries).toContain("Restaurant changed from Noodle Republic to Harbor & Vine");
    expect(summaries).toContain("Alex's dish changed from Classic Pad Thai to Garlic Butter Shrimp Scampi");
    expect(summaries).toContain("Alex's price changed from $13 to $19");
    expect(summaries.join(" ")).not.toContain(alex.id);
    expect(summaries.join(" ")).not.toContain("nr-pad-thai");
  });

  it("names a newly-joined diner", () => {
    const prev = recommendation({});
    const sam: DinerProfile = { id: "sam-uuid", name: "Sam", initials: "SA", beliefs: [], pastOrders: [] };
    const next = recommendation({
      version: 2,
      selections: [
        { dinerId: alex.id, dishId: "nr-pad-thai", price: 13, reason: "test" },
        { dinerId: sam.id, dishId: "nr-pad-thai", price: 13, reason: "test" },
      ],
    });

    const changes = diffRecommendations(prev, next, [alex, sam], restaurants);
    expect(changes.map((c) => c.summary)).toContain("Sam joined the order");
  });

  it("falls back to the raw id if a name can't be resolved", () => {
    const prev = recommendation({});
    const next = recommendation({ version: 2, restaurantId: "unknown-restaurant" });

    const changes = diffRecommendations(prev, next, [alex], restaurants);
    expect(changes[0].summary).toBe("Restaurant changed from Noodle Republic to unknown-restaurant");
  });
});
