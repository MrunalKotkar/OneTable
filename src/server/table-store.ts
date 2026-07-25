import type {
  BeliefRevision,
  DinerProfile,
  GroupMealSummary,
  Recommendation,
} from "@/domain/contracts";
import {
  buildJordanRevision,
  demoDiners,
  demoGroupHistory,
  recommendationV1,
  recommendationV2,
  recommendationV3,
} from "@/data/demo-fixtures";
import type { Phase } from "@/lib/phase";

/**
 * Stand-in shared backend for the hackathon demo: an in-memory store on
 * the Next.js server process. This is what makes "share a table link and
 * have someone else join from their own device" possible at all, since
 * plain client-side React state can't be seen across devices.
 *
 * This is NOT Person 1's MemoryGateway or Person 2's NegotiationEngine —
 * it is a temporary, single-process, non-persistent stand-in (state is
 * lost on server restart, and this will misbehave if the app is ever
 * deployed across multiple server instances). It exists only so the
 * multi-device join/negotiate/revise story can be demoed end to end
 * before those real features exist.
 */

export interface TableState {
  id: string;
  intent: string;
  seatedDinerIds: string[];
  phase: Phase;
  recommendation: Recommendation | null;
  previousRecommendation: Recommendation | null;
  revision: BeliefRevision | null;
  errorMessage: string | null;
  approved: boolean;
  updatedAt: number;
}

export interface TableSnapshot extends TableState {
  diners: DinerProfile[];
}

const diners = new Map<string, DinerProfile>();
const tables = new Map<string, TableState>();
let groupHistory: GroupMealSummary[] = [];

function seedDiners(): void {
  diners.clear();
  for (const diner of demoDiners) {
    diners.set(diner.id, {
      ...diner,
      beliefs: diner.beliefs.map((belief) => ({ ...belief })),
    });
  }
}

function seedHistory(): void {
  groupHistory = demoGroupHistory.map((meal) => ({ ...meal }));
}

seedDiners();
seedHistory();

function makeTableId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function schedule(id: string, delayMs: number, mutate: (table: TableState) => void): void {
  setTimeout(() => {
    const table = tables.get(id);
    if (!table) return;
    mutate(table);
    table.updatedAt = Date.now();
  }, delayMs);
}

function resolveDiners(ids: string[]): DinerProfile[] {
  return ids.map((id) => diners.get(id)).filter((d): d is DinerProfile => Boolean(d));
}

export function createTable(intent: string): TableState {
  const id = makeTableId();
  const table: TableState = {
    id,
    intent,
    seatedDinerIds: ["alex", "sam", "jordan"],
    phase: "recalling",
    recommendation: null,
    previousRecommendation: null,
    revision: null,
    errorMessage: null,
    approved: false,
    updatedAt: Date.now(),
  };
  tables.set(id, table);

  schedule(id, 600, (t) => {
    t.phase = "negotiating";
  });
  schedule(id, 1300, (t) => {
    t.recommendation = { ...recommendationV1, changes: [] };
    t.phase = "ready";
  });

  return table;
}

/**
 * A diner opens the shared link and claims their seat. Idempotent for
 * diners already seated. Only Priya joining after the first
 * recommendation triggers the scripted rebalance (v1 -> v2) — this
 * mirrors docs/TEAM_PLAN.md's "Priya joins" story, which is the only
 * membership change the fixed fixtures model.
 */
export function joinTable(id: string, dinerId: string): TableState | null {
  const table = tables.get(id);
  if (!table) return null;
  if (!diners.has(dinerId)) return table;
  if (table.seatedDinerIds.includes(dinerId)) return table;

  table.seatedDinerIds = [...table.seatedDinerIds, dinerId];
  table.updatedAt = Date.now();

  if (dinerId === "priya" && table.recommendation?.version === 1) {
    table.phase = "recalling";
    schedule(id, 400, (t) => {
      t.phase = "rebalancing";
    });
    schedule(id, 1050, (t) => {
      t.previousRecommendation = t.recommendation;
      t.recommendation = recommendationV2;
      t.phase = "ready";
    });
  }

  return table;
}

/**
 * Jordan corrects his own belief from his own device. Updates the
 * shared diner record (so it persists for anyone who looks him up
 * later, independent of this table) and triggers the scripted
 * rebalance to v3.
 */
export function reviseJordanBelief(id: string): TableState | null {
  const table = tables.get(id);
  if (!table) return null;
  if (!table.seatedDinerIds.includes("jordan")) return table;
  if (table.revision) return table;

  table.phase = "revising_belief";
  table.updatedAt = Date.now();

  schedule(id, 550, (t) => {
    const revision = buildJordanRevision(new Date().toISOString());
    diners.set("jordan", {
      ...diners.get("jordan")!,
      beliefs: [{ ...revision.previous }, { ...revision.current }],
    });
    t.revision = revision;
    t.phase = "recalling";
  });
  schedule(id, 950, (t) => {
    t.phase = "rebalancing";
  });
  schedule(id, 1600, (t) => {
    t.previousRecommendation = t.recommendation;
    t.recommendation = recommendationV3;
    t.phase = "ready";
  });

  return table;
}

export function approveTable(id: string): TableState | null {
  const table = tables.get(id);
  if (!table) return null;
  table.approved = true;
  table.updatedAt = Date.now();
  return table;
}

export function getTable(id: string): TableSnapshot | null {
  const table = tables.get(id);
  if (!table) return null;
  return { ...table, diners: resolveDiners(table.seatedDinerIds) };
}

export function getAllDinerProfiles(): DinerProfile[] {
  return demoDiners.map((seed) => diners.get(seed.id) ?? seed);
}

export function getDinerProfile(id: string): DinerProfile | null {
  return diners.get(id) ?? null;
}

export function getGroupHistory(): GroupMealSummary[] {
  return groupHistory;
}

/** Demo-rehearsal reset: clears every table and restores seed beliefs. */
export function resetAll(): void {
  seedDiners();
  seedHistory();
  tables.clear();
}
