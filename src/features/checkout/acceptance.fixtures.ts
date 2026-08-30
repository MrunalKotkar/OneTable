import type {
  DinerFeedback,
  Recommendation,
  Restaurant,
} from "@/domain/contracts";
import type { SharedCheckoutItem } from "./contract";

/**
 * Test-only fixtures for acceptance.test.ts's money/supersession regression
 * net. Not demo/production data — this used to live in demo-fixtures.ts
 * alongside the fixture Stripe checkout used against fake data, but that
 * whole file was deleted in Phase 6 (real Stripe checkout now runs against
 * a table's actual recommendation, never a fixture). These fixtures still
 * pull their weight purely as deterministic test input.
 */
export const finalRecommendationFixture: Recommendation = {
  version: 3,
  restaurantId: "green-ladle",
  selections: [
    {
      dinerId: "alex",
      dishId: "garden-protein-bowl",
      price: 16,
      reason: "Vegetarian main with verified ingredients.",
    },
    {
      dinerId: "sam",
      dishId: "chicken-rice-plate",
      price: 18,
      reason: "High-protein option under Sam's budget.",
    },
    {
      dinerId: "jordan",
      dishId: "miso-mushroom-udon",
      price: 17,
      reason: "Shellfish-free replacement after Jordan's correction.",
    },
    {
      dinerId: "priya",
      dishId: "tomato-basil-pasta",
      price: 15,
      reason: "Verified peanut-free dish for Priya.",
    },
  ],
  total: 66,
  etaMinutes: 28,
  explanation:
    "Version 3 keeps every active constraint current after Priya joins and Jordan revises an outdated belief.",
  alternativeRestaurantId: "masa-market",
  changes: [
    {
      kind: "belief",
      summary: "Jordan's previous unrestricted belief was superseded.",
    },
    {
      kind: "dish",
      summary: "Jordan moved from shellfish noodles to mushroom udon.",
    },
  ],
};

export const finalRestaurantFixture: Restaurant = {
  id: "green-ladle",
  name: "Green Ladle Kitchen",
  cuisine: "Modern comfort",
  menu: [
    {
      id: "garden-protein-bowl",
      name: "Garden Protein Bowl",
      price: 16,
      tags: ["vegetarian", "protein"],
      allergens: [],
      allergenStatus: "verified",
      preparationMinutes: 14,
      available: true,
    },
    {
      id: "chicken-rice-plate",
      name: "Chicken Rice Plate",
      price: 18,
      tags: ["high protein"],
      allergens: [],
      allergenStatus: "verified",
      preparationMinutes: 18,
      available: true,
    },
    {
      id: "miso-mushroom-udon",
      name: "Miso Mushroom Udon",
      price: 17,
      tags: ["shellfish-free"],
      allergens: [],
      allergenStatus: "verified",
      preparationMinutes: 20,
      available: true,
    },
    {
      id: "tomato-basil-pasta",
      name: "Tomato Basil Pasta",
      price: 15,
      tags: ["peanut-free"],
      allergens: [],
      allergenStatus: "verified",
      preparationMinutes: 16,
      available: true,
    },
  ],
};

export const sharedCheckoutItemsFixture: SharedCheckoutItem[] = [
  {
    id: "sparkling-water",
    name: "Sparkling water for the table",
    price: 8,
    quantity: 1,
    participantIds: ["alex", "sam", "jordan", "priya"],
  },
];

export const feedbackFixture: DinerFeedback[] = [
  {
    dinerId: "alex",
    dishId: "garden-protein-bowl",
    liked: true,
    note: "Good vegetarian default for quick lunches.",
  },
  {
    dinerId: "sam",
    dishId: "chicken-rice-plate",
    liked: true,
  },
  {
    dinerId: "jordan",
    dishId: "miso-mushroom-udon",
    liked: true,
    note: "Keep shellfish-free choices prominent.",
  },
  {
    dinerId: "priya",
    dishId: "tomato-basil-pasta",
    liked: true,
  },
];
