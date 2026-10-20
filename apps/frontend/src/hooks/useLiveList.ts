"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import toast from "react-hot-toast";

// The caller memoizes load with its location, token and filters. Only the newest
// request may update the list; navigation and incoming events cancel older work.
export function useLiveList<T>(load: (signal: AbortSignal) => Promise<T[]>) {
  const revision = useRealtimeStore(state => state.revision);
  const [data, setData] = useState<T[]>([]);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    try {
      const result = await load(controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Live list refresh failed:", error);
        toast.error("Unable to refresh the list. Displayed data may be out of date.", { id: "live-list-error" });
      }
    }
  }, [load]);

  // Do not show a previous location/filter's rows if the new request fails.
  useEffect(() => setData([]), [load]);

  useEffect(() => {
    void refresh();
    return () => active.current?.abort();
  }, [refresh, revision]);

  return { data, refresh };
}
