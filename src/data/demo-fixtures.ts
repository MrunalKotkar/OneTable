import type {
  Belief,
  BeliefRevision,
  DinerProfile,
  GroupMealSummary,
  Recommendation,
  Restaurant,
} from "@/domain/contracts";

/**
 * Fixed fixtures for the Person 3 experience. These stand in for
 * MemoryGateway and NegotiationEngine output until those features exist,
 * per docs/TEAM_PLAN.md: "Build the judged interaction using fixed
 * recommendation and revision fixtures first."
 */

export const demoDiners: DinerProfile[] = [
  {
    id: "alex",
    name: "Alex",
    initials: "AL",
    beliefs: [
      {
        id: "alex-diet-1",
        kind: "diet",
        value: "vegetarian",
        status: "active",
        updatedAt: "2026-07-25T11:30:00.000Z",
        supersedes: null,
      },
    ],
    pastOrders: [],
  },
  {
    id: "sam",
    name: "Sam",
    initials: "SA",
    beliefs: [
      {
        id: "sam-goal-1",
        kind: "goal",
        value: "high protein",
        status: "active",
        updatedAt: "2026-07-25T11:30:00.000Z",
        supersedes: null,
      },
      {
        id: "sam-budget-1",
        kind: "budget",
        value: 20,
        status: "active",
        updatedAt: "2026-07-25T11:30:00.000Z",
        supersedes: null,
      },
    ],
    pastOrders: [],
  },
  {
    id: "jordan",
    name: "Jordan",
    initials: "JO",
    beliefs: [
      {
        id: "jordan-diet-1",
        kind: "diet",
        value: "no dietary restrictions",
        status: "active",
        updatedAt: "2026-07-25T11:30:00.000Z",
        supersedes: null,
      },
    ],
    pastOrders: [],
  },
  {
    id: "priya",
    name: "Priya",
    initials: "PR",
    beliefs: [
      {
        id: "priya-allergy-1",
        kind: "allergy",
        value: "peanuts",
        status: "active",
        updatedAt: "2026-07-25T11:30:00.000Z",
        supersedes: null,
      },
    ],
    pastOrders: [],
  },
];

/** Jordan's belief once the in-session correction is applied. */
export const jordanRevisedBelief: Belief = {
  id: "jordan-allergy-1",
  kind: "allergy",
  value: "shellfish",
  status: "active",
  updatedAt: "2026-07-25T11:30:00.000Z", // overwritten with "now" when applied
  supersedes: "jordan-diet-1",
};

export const jordanSupersededBelief: Belief = {
  ...demoDiners[2].beliefs[0],
  status: "superseded",
};

/** Previous + replacement pair for the audit UI, per Person 1's handoff. */
export function buildJordanRevision(now: string): BeliefRevision {
  return {
    dinerId: "jordan",
    previous: { ...jordanSupersededBelief, updatedAt: now },
    current: { ...jordanRevisedBelief, updatedAt: now },
  };
}

export const demoRestaurants: Restaurant[] = [
  {
    id: "sprout-and-grain",
    name: "Sprout & Grain",
    cuisine: "Californian",
    menu: [
      {
        id: "sprout-broccoli-bowl",
        name: "Charred Broccoli Grain Bowl",
        price: 14,
        tags: ["vegetarian"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 12,
        available: true,
      },
      {
        id: "sprout-miso-salmon",
        name: "Miso-Glazed Salmon Protein Plate",
        price: 18,
        tags: ["high-protein"],
        allergens: ["fish"],
        allergenStatus: "verified",
        preparationMinutes: 16,
        available: true,
      },
      {
        id: "sprout-herb-chicken",
        name: "Herb Roasted Chicken",
        price: 16,
        tags: [],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 18,
        available: true,
      },
    ],
  },
  {
    id: "tidewater-coastal-kitchen",
    name: "Tidewater Coastal Kitchen",
    cuisine: "Seafood",
    menu: [
      {
        id: "tidewater-veg-orzo",
        name: "Grilled Vegetable Orzo",
        price: 15,
        tags: ["vegetarian"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 14,
        available: true,
      },
      {
        id: "tidewater-cedar-salmon",
        name: "Cedar Plank Salmon",
        price: 19,
        tags: ["high-protein"],
        allergens: ["fish"],
        allergenStatus: "verified",
        preparationMinutes: 20,
        available: true,
      },
      {
        id: "tidewater-shrimp-linguine",
        name: "Garlic Butter Shrimp Linguine",
        price: 18,
        tags: [],
        allergens: ["shellfish"],
        allergenStatus: "verified",
        preparationMinutes: 16,
        available: true,
      },
      {
        id: "tidewater-lemon-chicken",
        name: "Lemon Herb Chicken",
        price: 17,
        tags: [],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 15,
        available: true,
      },
    ],
  },
  {
    id: "green-table-bistro",
    name: "Green Table Bistro",
    cuisine: "Mediterranean-American",
    menu: [
      {
        id: "green-falafel-plate",
        name: "Falafel & Charred Vegetable Plate",
        price: 14,
        tags: ["vegetarian"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 15,
        available: true,
      },
      {
        id: "green-chicken-power-bowl",
        name: "Grilled Chicken Power Bowl",
        price: 19,
        tags: ["high-protein"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 20,
        available: true,
      },
      {
        id: "green-herb-chicken-thighs",
        name: "Herb Roasted Chicken Thighs",
        price: 16,
        tags: [],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 17,
        available: true,
      },
      {
        id: "green-veg-quinoa-salad",
        name: "Roasted Vegetable & Quinoa Salad",
        price: 15,
        tags: ["vegetarian"],
        allergens: [],
        allergenStatus: "verified",
        preparationMinutes: 14,
        available: true,
      },
    ],
  },
];

/** Version 1: Alex, Sam, and Jordan only. */
export const recommendationV1: Recommendation = {
  version: 1,
  restaurantId: "sprout-and-grain",
  selections: [
    {
      dinerId: "alex",
      dishId: "sprout-broccoli-bowl",
      price: 14,
      reason: "Matches Alex's active vegetarian belief.",
    },
    {
      dinerId: "sam",
      dishId: "sprout-miso-salmon",
      price: 18,
      reason: "High-protein pick that stays under Sam's $20 budget belief.",
    },
    {
      dinerId: "jordan",
      dishId: "sprout-herb-chicken",
      price: 16,
      reason: "No active dietary restriction on file, so the group's top overall pick was selected.",
    },
  ],
  total: 48,
  etaMinutes: 28,
  explanation:
    "Sprout & Grain gives every current diner a verified dish inside their active constraints: vegetarian for Alex, high-protein under budget for Sam, and no restriction limits Jordan's choice.",
  alternativeRestaurantId: "green-table-bistro",
  changes: [],
};

/** Version 2: Priya joins. Jordan still has no restriction on file. */
export const recommendationV2: Recommendation = {
  version: 2,
  restaurantId: "tidewater-coastal-kitchen",
  selections: [
    {
      dinerId: "alex",
      dishId: "tidewater-veg-orzo",
      price: 15,
      reason: "Matches Alex's active vegetarian belief.",
    },
    {
      dinerId: "sam",
      dishId: "tidewater-cedar-salmon",
      price: 19,
      reason: "High-protein pick that stays under Sam's $20 budget belief.",
    },
    {
      dinerId: "jordan",
      dishId: "tidewater-shrimp-linguine",
      price: 18,
      reason: "No active dietary restriction on file, so the group's top overall pick was selected.",
    },
    {
      dinerId: "priya",
      dishId: "tidewater-lemon-chicken",
      price: 17,
      reason: "Verified peanut-free, respecting Priya's active peanut allergy.",
    },
  ],
  total: 69,
  etaMinutes: 30,
  explanation:
    "Sprout & Grain had no verified peanut-free dish for Priya, so the table moved to Tidewater Coastal Kitchen, which has a safe option for every current diner.",
  alternativeRestaurantId: "green-table-bistro",
  changes: [
    { kind: "member", summary: "Priya joined the table." },
    {
      kind: "restaurant",
      summary:
        "Restaurant changed to Tidewater Coastal Kitchen because Sprout & Grain had no verified peanut-free dish for Priya.",
    },
    {
      kind: "dish",
      summary: "Alex and Sam received new dishes from the new menu.",
    },
  ],
};

/** Version 3: Jordan's belief is revised to a shellfish allergy. */
export const recommendationV3: Recommendation = {
  version: 3,
  restaurantId: "green-table-bistro",
  selections: [
    {
      dinerId: "alex",
      dishId: "green-falafel-plate",
      price: 14,
      reason: "Matches Alex's active vegetarian belief.",
    },
    {
      dinerId: "sam",
      dishId: "green-chicken-power-bowl",
      price: 19,
      reason: "High-protein pick that stays under Sam's $20 budget belief.",
    },
    {
      dinerId: "jordan",
      dishId: "green-herb-chicken-thighs",
      price: 16,
      reason: "Contains no shellfish, respecting Jordan's new active shellfish allergy.",
    },
    {
      dinerId: "priya",
      dishId: "green-veg-quinoa-salad",
      price: 15,
      reason: "Verified peanut-free, respecting Priya's active peanut allergy.",
    },
  ],
  total: 64,
  etaMinutes: 30,
  explanation:
    "Green Table Bistro has zero shellfish on its menu, making it the safe fallback now that Jordan has an active shellfish allergy. Every other diner keeps a dish matching their active constraint.",
  alternativeRestaurantId: "sprout-and-grain",
  changes: [
    {
      kind: "belief",
      summary: "Jordan's belief changed from no dietary restrictions to a shellfish allergy.",
    },
    {
      kind: "restaurant",
      summary:
        "Restaurant changed to Green Table Bistro because Tidewater's dish for Jordan contained shellfish.",
    },
    {
      kind: "dish",
      summary: "Jordan's shrimp linguine was replaced with herb roasted chicken thighs.",
    },
  ],
};

/** Proves persistence: a meal that happened before this session started. */
export const demoGroupHistory: GroupMealSummary[] = [
  {
    restaurant: "Green Table Bistro",
    occurredAt: "2026-07-18T12:15:00.000Z",
    rating: 5,
  },
];
