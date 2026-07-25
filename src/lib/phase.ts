/** Shared UI state contract, used by both the server-side table store and the client. */
export type Phase =
  | "idle"
  | "recalling"
  | "negotiating"
  | "ready"
  | "revising_belief"
  | "rebalancing"
  | "no_feasible_result"
  | "error";
