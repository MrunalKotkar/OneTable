import type { Belief, Dish, DinerProfile } from "@/domain/contracts";

/**
 * Presentation-only helpers that translate a diner's active beliefs into
 * human-readable, visibly-checkable hard-constraint compatibility for a
 * fixed fixture dish. This is not the negotiation engine (Person 2 owns
 * that); it only explains why a fixture selection already respects the
 * active beliefs.
 */

const ALLERGEN_ALIASES: Record<string, string> = {
  peanuts: "peanut",
  peanut: "peanut",
  shellfish: "shellfish",
};

export interface ConstraintCheck {
  belief: Belief;
  label: string;
  satisfied: boolean;
  detail: string;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function activeBeliefs(diner: DinerProfile): Belief[] {
  return diner.beliefs.filter((belief) => belief.status === "active");
}

export function beliefLabel(belief: Belief): string {
  switch (belief.kind) {
    case "allergy":
      return `${capitalize(String(belief.value))} allergy`;
    case "diet":
      return capitalize(String(belief.value));
    case "budget":
      return `Under $${belief.value} budget`;
    case "goal":
      return capitalize(String(belief.value));
    case "preference":
      return capitalize(String(belief.value));
    case "dislike":
      return `Dislikes ${belief.value}`;
    default:
      return String(belief.value);
  }
}

function evaluate(dish: Dish, belief: Belief): ConstraintCheck {
  const label = beliefLabel(belief);

  if (belief.kind === "allergy") {
    const term =
      ALLERGEN_ALIASES[String(belief.value).toLowerCase()] ??
      String(belief.value).toLowerCase();
    const flagged = dish.allergens
      .map((allergen) => allergen.toLowerCase())
      .includes(term);
    const unverified = dish.allergenStatus !== "verified";
    const satisfied = !flagged && !unverified;
    const detail = flagged
      ? `Contains ${term}.`
      : unverified
        ? "Allergen status not verified."
        : `Verified ${term}-free.`;
    return { belief, label, satisfied, detail };
  }

  if (belief.kind === "diet") {
    if (String(belief.value).toLowerCase() === "no dietary restrictions") {
      return {
        belief,
        label: "No restriction on file",
        satisfied: true,
        detail: "No active dietary constraint to check.",
      };
    }
    const tag = String(belief.value).toLowerCase();
    const satisfied = dish.tags.map((t) => t.toLowerCase()).includes(tag);
    return {
      belief,
      label,
      satisfied,
      detail: satisfied ? `Tagged ${tag}.` : `Not tagged ${tag}.`,
    };
  }

  if (belief.kind === "budget") {
    const limit = Number(belief.value);
    const satisfied = dish.price <= limit;
    return {
      belief,
      label,
      satisfied,
      detail: `$${dish.price} ${satisfied ? "is under" : "exceeds"} the $${limit} budget.`,
    };
  }

  if (belief.kind === "goal") {
    const tag = String(belief.value).toLowerCase().replace(/\s+/g, "-");
    const satisfied = dish.tags.map((t) => t.toLowerCase()).includes(tag);
    return {
      belief,
      label,
      satisfied,
      detail: satisfied ? `Tagged ${tag}.` : `Not tagged ${tag}.`,
    };
  }

  return { belief, label, satisfied: true, detail: "Informational only." };
}

export function checkDishAgainstDiner(
  dish: Dish,
  diner: DinerProfile,
): ConstraintCheck[] {
  return activeBeliefs(diner).map((belief) => evaluate(dish, belief));
}
