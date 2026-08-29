import type { Belief, BeliefKind } from "@/domain/contracts";

/**
 * Choose which existing active belief a correction supersedes. Shared by
 * every MemoryGateway implementation (mock, db) — previously duplicated
 * near-verbatim in mock-gateway.ts and the now-deleted xtrace-gateway.ts.
 *
 * 1. A same-kind active belief is the direct replacement (e.g. a new budget
 *    supersedes the old budget).
 * 2. Otherwise, introducing a hard restriction (allergy/diet) supersedes an
 *    active "no dietary restrictions" marker. This is Jordan's path: the
 *    correction is an ALLERGY, but the belief it retires is the DIET belief
 *    that asserted no constraints.
 */
export function pickSupersededBelief(
  active: Belief[],
  kind: BeliefKind,
): Belief | null {
  const sameKind = active.find((b) => b.kind === kind);
  if (sameKind) return sameKind;

  if (kind === "allergy" || kind === "diet") {
    const unrestricted = active.find(
      (b) => b.kind === "diet" && b.value === "no dietary restrictions",
    );
    if (unrestricted) return unrestricted;
  }

  return null;
}
