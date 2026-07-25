import type { DinerProfile, GroupMealSummary } from "@/domain/contracts";
import type { TableSnapshot } from "@/server/table-store";

async function parseOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  return (await res.json()) as T;
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

export async function joinTableRequest(
  id: string,
  dinerId: string,
): Promise<TableSnapshot | null> {
  const res = await fetch(`/api/tables/${id}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dinerId }),
  });
  return parseOrNull(res);
}

export async function reviseJordanRequest(id: string): Promise<TableSnapshot | null> {
  const res = await fetch(`/api/tables/${id}/revise-belief`, { method: "POST" });
  return parseOrNull(res);
}

export async function approveTableRequest(id: string): Promise<TableSnapshot | null> {
  const res = await fetch(`/api/tables/${id}/approve`, { method: "POST" });
  return parseOrNull(res);
}

export async function fetchAllDiners(): Promise<DinerProfile[]> {
  const res = await fetch("/api/diners", { cache: "no-store" });
  const data = await parseOrNull<{ diners: DinerProfile[] }>(res);
  return data?.diners ?? [];
}

export async function fetchDinerProfile(
  id: string,
): Promise<{ diner: DinerProfile; history: GroupMealSummary[] } | null> {
  const res = await fetch(`/api/diners/${id}`, { cache: "no-store" });
  return parseOrNull(res);
}

export async function resetDemo(): Promise<void> {
  await fetch("/api/reset", { method: "POST" });
}
