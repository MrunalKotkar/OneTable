/**
 * There is no real auth in this hackathon build. A browser "claims" a
 * diner identity for a given table by writing it to localStorage — that
 * claim is what gates identity-specific actions (like Jordan correcting
 * his own belief) on the shared table page. Anyone can claim any
 * not-yet-taken-by-them identity; this does not stop two browsers from
 * both claiming the same diner.
 *
 * Exposes a subscribe/notify pair so components can read the claim via
 * useSyncExternalStore instead of effect+setState (which both mismatches
 * SSR and trips the react-hooks "no setState in effect" rule).
 */

type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

function key(tableId: string): string {
  return `onetable:claim:${tableId}`;
}

export function getClaim(tableId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key(tableId));
}

export function setClaim(tableId: string, dinerId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(tableId), dinerId);
  notify();
}

export function clearClaim(tableId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(tableId));
  notify();
}

export function subscribeClaim(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getServerClaimSnapshot(): null {
  return null;
}
