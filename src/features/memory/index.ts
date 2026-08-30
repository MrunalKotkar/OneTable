import { dbMemoryGateway } from "./db-gateway";
import { mockMemoryGateway } from "./mock-gateway";
import type { MemoryGateway } from "./contract";

export type { MemoryGateway, ReviseBeliefInput } from "./contract";
export { mockMemoryGateway } from "./mock-gateway";
export { dbMemoryGateway } from "./db-gateway";
export { resetStore } from "./store";

/**
 * Pick the live provider. DB-backed whenever DATABASE_URL is configured
 * (the real deployed path, and the only path since Phase 4 — table-store.ts
 * itself requires a DB now); otherwise the deterministic in-process mock.
 * `MEMORY_PROVIDER=mock` forces the mock even with a DATABASE_URL present,
 * for quickly comparing behavior against it.
 *
 * Called at request time (not memoized) so it always reflects the current
 * env, same as the pre-DB version of this file did for XTrace.
 */
export function isMockMemorySelected(): boolean {
  return process.env.MEMORY_PROVIDER?.toLowerCase() === "mock";
}

export function selectMemoryGateway(): MemoryGateway {
  if (isMockMemorySelected()) return mockMemoryGateway;
  if (process.env.DATABASE_URL) return dbMemoryGateway;
  return mockMemoryGateway;
}

export const memoryGateway: MemoryGateway = selectMemoryGateway();
