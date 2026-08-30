import type { BeliefKind, DinerProfile, GroupMealSummary } from "@/domain/contracts";
import type { TableSnapshot } from "@/server/table-store";

export interface ActionResult {
  table: TableSnapshot | null;
  error: string | null;
}

async function parseOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function postAction(url: string, body?: unknown): Promise<ActionResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { table: null, error: data?.message ?? "Request failed." };
  }
  return { table: data as TableSnapshot, error: null };
}

export async function createTableRequest(intent: string): Promise<{ id: string } | null> {
  const res = await fetch("/api/tables", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent }),
  });
  return parseOrNull(res);
}

export async function fetchTable(id: string): Promise<TableSnapshot | null> {
  const res = await fetch(`/api/tables/${id}`, { cache: "no-store" });
  return parseOrNull(res);
}

export async function joinTableRequest(id: string): Promise<ActionResult> {
  return postAction(`/api/tables/${id}/join`);
}

export async function reviseBeliefRequest(
  id: string,
  kind: BeliefKind,
  value: string | number,
  correctionText: string,
): Promise<ActionResult> {
  return postAction(`/api/tables/${id}/revise-belief`, { kind, value, correctionText });
}

export async function approveTableRequest(id: string): Promise<ActionResult> {
  return postAction(`/api/tables/${id}/approve`);
}

export async function startCheckoutRequest(id: string): Promise<ActionResult> {
  return postAction(`/api/tables/${id}/checkout`);
}

export async function payTableRequest(id: string, forceFailure = false): Promise<ActionResult> {
  return postAction(`/api/tables/${id}/pay`, { forceFailure });
}

export async function submitFeedbackRequest(
  id: string,
  liked: boolean,
  note?: string,
): Promise<ActionResult> {
  return postAction(`/api/tables/${id}/feedback`, { liked, note });
}

export async function fetchDinerProfile(
  id: string,
): Promise<{ diner: DinerProfile; history: GroupMealSummary[] } | null> {
  const res = await fetch(`/api/diners/${id}`, { cache: "no-store" });
  return parseOrNull(res);
}
