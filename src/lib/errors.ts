/**
 * Domain-level outcome for "no restaurant satisfies every active
 * constraint" (see docs/TEAM_PLAN.md: "The engine must return 'no
 * feasible result' rather than fabricate safety."). This is a safe,
 * explicit outcome, not a transient failure — it is never retried
 * automatically.
 *
 * Once Person 2's real NegotiationEngine is wired in, its adapter
 * should throw this (instead of resolving to a fabricated
 * Recommendation) when no restaurant in the catalog is feasible for
 * the current GroupContext.
 */
export class NoFeasibleResultError extends Error {
  constructor(message = "No restaurant satisfies every active constraint.") {
    super(message);
    this.name = "NoFeasibleResultError";
  }
}
