"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import toast from "react-hot-toast";

const EMPTY: never[] = [];
// A failed reload is tried again by itself after these delays (the last repeats), so a list shows
// fresh rows again once the Wi-Fi recovers, without waiting for the next live notice.
export const LIST_RETRY_DELAYS_MS = [3_000, 10_000, 30_000];

// The caller memoizes load with its token and filters. Only the newest
// request may update the list; navigation and incoming events cancel older work.
export function useLiveList<T>(load: (signal: AbortSignal) => Promise<T[]>) {
  const revision = useRealtimeStore(state => state.revision);
  // Rows are stored with the `load` that produced them, so after the token or
  // filter changes, the previous rows are never shown or reported as loaded, even briefly.
  const [result, setResult] = useState<{ load: typeof load | null; data: T[] }>({ load: null, data: EMPTY });
  const active = useRef<AbortController | null>(null);
  const retry = useRef<{ timer?: ReturnType<typeof setTimeout>; failures: number }>({ failures: 0 });
  const refresh = useCallback(async () => {
    active.current?.abort();
    clearTimeout(retry.current.timer);
    const controller = new AbortController();
    active.current = controller;
    try {
      const data = await load(controller.signal);
      if (!controller.signal.aborted) {
        retry.current.failures = 0;
        setResult({ load, data });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const delay = LIST_RETRY_DELAYS_MS[Math.min(retry.current.failures++, LIST_RETRY_DELAYS_MS.length - 1)];
        retry.current.timer = setTimeout(() => void refresh(), delay);
        console.error("Live list refresh failed:", error);
        toast.error("Unable to refresh the list. Displayed data may be out of date.", { id: "live-list-error" });
        // Answered, though without fresh rows: keep this load's rows, never another load's.
        setResult(previous => ({ load, data: previous.load === load ? previous.data : EMPTY }));
      }
    }
  }, [load]);

  useEffect(() => {
    void refresh();
    const pending = retry.current;
    return () => { active.current?.abort(); clearTimeout(pending.timer); };
  }, [refresh, revision]);

  const current = result.load === load;
  // `loaded` is true once the current `load` has answered (or failed), so callers can tell
  // "empty" from "still loading".
  return { data: current ? result.data : (EMPTY as T[]), refresh, loaded: current };
}
