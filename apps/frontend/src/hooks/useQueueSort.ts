"use client";

import { useCallback, useEffect, useState } from "react";
import { backend_url } from "@/constants/env_variable";
import { StationId } from "@/constants/stations";
import { useUserStore } from "@/stores/useUserStore";
import { isQueueSortMode, QueueSortMode } from "@/lib/queueSort";

export function useQueueSort(queue: StationId | "home") {
  const userId = useUserStore(state => state.user?.id);
  const fallback: QueueSortMode = queue === "home" ? "number" : "arrival";
  // Preferences belong to this user, backend and queue on this browser, not the clinic.
  const key = userId == null ? null : `veasna:queue-sort:v1:${backend_url}:${userId}:${queue}`;
  const [saved, setSaved] = useState<{ key: string | null; mode: QueueSortMode }>({ key: null, mode: fallback });
  const mode = saved.key === key ? saved.mode : fallback;

  useEffect(() => {
    const read = () => {
      let value: unknown;
      try { value = key ? localStorage.getItem(key) : null; } catch { /* Storage can be blocked. */ }
      setSaved({ key, mode: isQueueSortMode(value) ? value : fallback });
    };
    read();
    const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, fallback]);

  const setMode = useCallback((next: QueueSortMode) => {
    setSaved({ key, mode: next });
    try { if (key) localStorage.setItem(key, next); } catch { /* Keep the in-memory choice usable. */ }
  }, [key]);

  return { mode, setMode };
}
