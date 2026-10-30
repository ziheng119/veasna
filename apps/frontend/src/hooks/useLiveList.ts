"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import toast from "react-hot-toast";

const EMPTY: never[] = [];

// The caller memoizes load with its location, token and filters. Only the newest
// request may update the list; navigation and incoming events cancel older work.
export function useLiveList<T>(load: (signal: AbortSignal) => Promise<T[]>) {
  const revision = useRealtimeStore(state => state.revision);
  // Rows are stored with the `load` that produced them, so after the location, token or
  // filter changes, the previous rows are never shown or reported as loaded, even briefly.
  const [result, setResult] = useState<{ load: typeof load | null; data: T[] }>({ load: null, data: EMPTY });
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    try {
      const data = await load(controller.signal);
      if (!controller.signal.aborted) setResult({ load, data });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Live list refresh failed:", error);
        toast.error("Unable to refresh the list. Displayed data may be out of date.", { id: "live-list-error" });
        // Answered, though without fresh rows: keep this load's rows, never another load's.
        setResult(previous => ({ load, data: previous.load === load ? previous.data : EMPTY }));
      }
    }
  }, [load]);

  useEffect(() => {
    void refresh();
    return () => active.current?.abort();
  }, [refresh, revision]);

  const current = result.load === load;
  // `loaded` is true once the current `load` has answered (or failed), so callers can tell
  // "empty" from "still loading".
  return { data: current ? result.data : (EMPTY as T[]), refresh, loaded: current };
}
