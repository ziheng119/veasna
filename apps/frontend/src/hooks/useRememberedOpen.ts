"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Whether a foldable section is open, remembered on this device (e.g. a doctor who folds From
 * Registration keeps it folded for the next patient). Open until the stored choice is read, and when
 * storage is unavailable.
 */
export function useRememberedOpen(key: string, initial = true): [boolean, (open: boolean) => void] {
  const storageKey = `veasna-fold:${key}`;
  const [open, setOpenState] = useState(initial);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored !== null) setOpenState(stored === "open");
    } catch { /* private window or blocked storage: keep the default */ }
  }, [storageKey]);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try { window.localStorage.setItem(storageKey, next ? "open" : "folded"); } catch { /* not remembered */ }
  }, [storageKey]);
  return [open, setOpen];
}
