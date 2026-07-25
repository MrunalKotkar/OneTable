import type { Belief, DinerProfile, MealOutcome } from "@/domain/contracts";
import { demoDiners } from "@/data/demo-fixtures";

/**
 * In-memory backing store for the mock MemoryGateway.
 *
 * State lives at module scope, so it persists across requests for the life of
 * the running server process. That is what makes the "fresh session" proof
 * work in the demo: a new browser session hits the same process and still sees
 * Jordan's revised belief. (Swap this module for a file/DB-backed store if you
 * need durability across a full server restart.)
 *
 * The store keeps the FULL belief list per diner (active + superseded). Recall
 * is responsible for filtering down to active beliefs; history reads the
 * superseded ones.
 */

interface StoredState {
  diners: Map<string, DinerProfile>;
  outcomes: MealOutcome[];
}

function seed(): StoredState {
  const diners = new Map<string, DinerProfile>();
  for (const diner of demoDiners) {
    // Deep clone so mutations never leak back into the shared fixture.
    diners.set(diner.id, structuredClone(diner));
  }
  return { diners, outcomes: [] };
}

let state: StoredState = seed();

export function resetStore(): void {
  state = seed();
}

export function getDiner(dinerId: string): DinerProfile | undefined {
  return state.diners.get(dinerId);
}

export function getDiners(dinerIds: string[]): DinerProfile[] {
  return dinerIds
    .map((id) => state.diners.get(id))
    .filter((d): d is DinerProfile => d !== undefined);
}

export function activeBeliefs(diner: DinerProfile): Belief[] {
  return diner.beliefs.filter((b) => b.status === "active");
}

export function replaceBeliefs(dinerId: string, beliefs: Belief[]): void {
  const diner = state.diners.get(dinerId);
  if (!diner) return;
  diner.beliefs = beliefs;
}

export function addOutcome(outcome: MealOutcome): void {
  state.outcomes.push(outcome);
}

export function getOutcomes(): MealOutcome[] {
  return state.outcomes;
}
