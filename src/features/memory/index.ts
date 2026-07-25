import type { MemoryGateway } from "./contract";
import { mockMemoryGateway } from "./mock-gateway";
import { xtraceMemoryGateway } from "./xtrace-gateway";

export type { MemoryGateway, ReviseBeliefInput } from "./contract";
export { mockMemoryGateway } from "./mock-gateway";
export { xtraceMemoryGateway, resetXtraceProcessState } from "./xtrace-gateway";
export { resetStore } from "./store";

/**
 * Pick the live provider. XTrace only when explicitly selected AND a key is
 * present; otherwise the deterministic mock (also the offline-safe fallback, so
 * a missing key or unreachable XTrace can never break the demo).
 *
 * Called at request time (not memoized) so it always reflects the current env.
 */
export function selectMemoryGateway(): MemoryGateway {
  const provider = process.env.MEMORY_PROVIDER?.toLowerCase();
  if (provider === "xtrace" && process.env.XTRACE_API_KEY) {
    return xtraceMemoryGateway;
  }
  return mockMemoryGateway;
}
