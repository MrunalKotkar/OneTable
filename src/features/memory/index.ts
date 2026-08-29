import { dbMemoryGateway } from "./db-gateway";
import { mockMemoryGateway } from "./mock-gateway";
import type { MemoryGateway } from "./contract";

export type { MemoryGateway, ReviseBeliefInput } from "./contract";
export { mockMemoryGateway } from "./mock-gateway";
export { dbMemoryGateway } from "./db-gateway";
export { resetStore } from "./store";

/**
 * Pick the live provider. DB-backed whenever DATABASE_URL is configured
 * (the real deployed path); otherwise the deterministic in-process mock —
 * also the offline-safe fallback for local dev without a DB, and
 * `MEMORY_PROVIDER=mock` forces it even with a DATABASE_URL present (handy
 * for quickly comparing behavior against the mock).
 *
 * Called at request time (not memoized) so it always reflects the current
 * env, same as the pre-DB version of this file did for XTrace.
 */
export function selectMemoryGateway(): MemoryGateway {
  if (process.env.MEMORY_PROVIDER?.toLowerCase() === "mock") {
    return mockMemoryGateway;
  }
  if (process.env.DATABASE_URL) {
    return dbMemoryGateway;
  }
  return mockMemoryGateway;
}

export const memoryGateway: MemoryGateway = selectMemoryGateway();
