"use client";

import { useEffect, useState } from "react";
import type { TableSnapshot } from "@/server/table-store";
import { fetchTable } from "@/lib/api";

/**
 * Polls the shared table state so every device at the table sees the
 * same recommendation/phase/revision without a websocket server.
 * Simple and good enough for a hackathon demo; not real-time.
 */
export function useTablePolling(tableId: string, intervalMs = 1500) {
  const [table, setTable] = useState<TableSnapshot | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const result = await fetchTable(tableId);
      if (cancelled) return;
      if (!result) {
        setNotFound(true);
        return;
      }
      setTable(result);
      timer = setTimeout(poll, intervalMs);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tableId, intervalMs]);

  return { table, notFound };
}
