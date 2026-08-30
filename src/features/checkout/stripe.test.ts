import { afterEach, describe, expect, it, vi } from "vitest";
import type { Recommendation, Restaurant } from "@/domain/contracts";
import { buildStripeLineItems, buildStripeMetadata, getStripe } from "./stripe";

const restaurant: Restaurant = {
  id: "green-fork-kitchen",
  name: "Green Fork Kitchen",
  cuisine: "Farm-to-table",
  menu: [
    {
      id: "gf-quinoa-power-bowl",
      name: "Quinoa Power Bowl",
      price: 14,
      tags: ["vegetarian"],
      allergens: [],
      allergenStatus: "verified",
      preparationMinutes: 10,
      available: true,
    },
  ],
};

const recommendation: Recommendation = {
  version: 1,
  restaurantId: restaurant.id,
  selections: [{ dinerId: "alex", dishId: "gf-quinoa-power-bowl", price: 14, reason: "test" }],
  total: 14,
  etaMinutes: 18,
  explanation: "test",
  alternativeRestaurantId: null,
  changes: [],
};

describe("buildStripeLineItems", () => {
  it("prices each selection in cents against the real dish name", () => {
    const lineItems = buildStripeLineItems({ recommendation, restaurant, sharedItems: [] });
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]).toMatchObject({
      price_data: { unit_amount: 1400, product_data: { name: "Quinoa Power Bowl" } },
      quantity: 1,
    });
  });

  it("adds one line item per shared item, split across however many diners", () => {
    const lineItems = buildStripeLineItems({
      recommendation,
      restaurant,
      sharedItems: [{ id: "water", name: "Sparkling water", price: 8, quantity: 1, participantIds: ["alex", "sam"] }],
    });
    expect(lineItems).toHaveLength(2);
    expect(lineItems[1]).toMatchObject({ price_data: { unit_amount: 800 } });
  });
});

describe("buildStripeMetadata", () => {
  it("carries the real tableId, not just the checkout session", () => {
    const metadata = buildStripeMetadata({
      checkoutSessionId: "checkout-v1",
      recommendationVersion: 1,
      groupId: "group-1",
      tableId: "TABLE1",
    });
    expect(metadata).toEqual({
      checkoutSessionId: "checkout-v1",
      recommendationVersion: "1",
      groupId: "group-1",
      tableId: "TABLE1",
      source: "onetable",
    });
  });
});

describe("getStripe", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to run with a live-mode key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_something");
    expect(() => getStripe()).toThrow(/test mode/i);
  });

  it("accepts a test-mode key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_something");
    expect(() => getStripe()).not.toThrow();
  });
});
