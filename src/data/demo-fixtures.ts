import type { DinerProfile } from "@/domain/contracts";

/**
 * Seed diner identities for the demo group (Alex, Sam, Jordan, Priya).
 *
 * This is now consumed by `src/features/memory/store.ts` as the real
 * MemoryGateway's initial state — it is no longer a Person 3 stand-in for
 * memory/negotiation output. Recommendations are computed live by the real
 * NegotiationEngine (`@/features/negotiation/engine`) against context
 * recalled from the real MemoryGateway (`@/features/memory`), using the
 * restaurant catalog in `@/data/restaurant-catalog`.
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
