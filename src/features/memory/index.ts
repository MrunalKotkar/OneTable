import { mockMemoryGateway } from "./mock-gateway";
import { xtraceMemoryGateway } from "./xtrace-gateway";
import type { MemoryGateway } from "./contract";

export type { MemoryGateway, ReviseBeliefInput } from "./contract";
export { mockMemoryGateway } from "./mock-gateway";
export { xtraceMemoryGateway } from "./xtrace-gateway";
export { resetStore } from "./store";

/**
 * Default gateway, selected by env. Falls back to the mock unless the caller
 * explicitly opts into XTrace with both MEMORY_PROVIDER=xtrace and a key
 * present — this keeps the demo offline-safe for anyone who hasn't set up
 * XTrace credentials.
 */
export const memoryGateway: MemoryGateway =
  process.env.MEMORY_PROVIDER === "xtrace" && !!process.env.XTRACE_API_KEY
    ? xtraceMemoryGateway
    : mockMemoryGateway;
