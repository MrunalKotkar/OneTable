/**
 * The one fixed demo group/cast, shared by table-store.ts, db/seed.ts, and
 * reset-demo-group.ts so the id doesn't drift between them. Goes away in
 * Phase 5, when diners/groups come from real accounts instead of a fixed
 * cast.
 */
export const DEMO_GROUP_ID = "demo-group";
export const DEMO_DINER_IDS = ["alex", "sam", "jordan", "priya"];
