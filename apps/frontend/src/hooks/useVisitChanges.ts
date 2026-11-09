"use client";
import { useEffect, useState } from "react";
import { useRealtimeStore } from "@/stores/useRealtimeStore";

/**
 * Counts live notices that this visit was saved elsewhere (another device, or another panel on this
 * page), starting at 0 for each visit. Add it to a loader's dependencies to reload on change.
 */
export function useVisitChanges(visitId: number): number {
  const [count, setCount] = useState({ visitId, n: 0 });
  useEffect(() => useRealtimeStore.subscribe((state, previous) => {
    if (state.visitChanges === previous.visitChanges) return;
    const ids = state.visitChanges.visitIds;
    if (ids !== null && !ids.includes(visitId)) return;
    setCount(current => ({ visitId, n: current.visitId === visitId ? current.n + 1 : 1 }));
  }), [visitId]);
  return count.visitId === visitId ? count.n : 0;
}
