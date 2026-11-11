"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

// Waits before trying a failed load again; the last delay repeats until the host answers.
export const LOAD_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];

/**
 * Loads a station form's saved record when the form opens, and shows it. On weak Wi-Fi a load can
 * fail: it is then tried again by itself, after 2, 5 and 10 seconds and then every 20, until the
 * host answers. The form stays locked meanwhile (hooks/useSavedRecordAccess.ts), so nothing typed
 * can be saved over a record this device hasn't seen. Returns true while loading is failing.
 * `load` and `show` must be memoized (useCallback); a new `load` starts again.
 */
export function useRecordLoad<T>(load: (signal: AbortSignal) => Promise<T>, show: (data: T) => void, failure: string): boolean {
  const [failing, setFailing] = useState(false);
  const latest = useRef({ show, failure });
  latest.current = { show, failure };

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setFailing(false);
    const attempt = (tries: number) => {
      load(controller.signal).then((data) => {
        if (controller.signal.aborted) return;
        if (tries > 0) {
          setFailing(false);
          toast.dismiss("record-load");
        }
        latest.current.show(data);
      }, (error) => {
        if (controller.signal.aborted) return;
        console.error(`${latest.current.failure}:`, error);
        // One message, kept up while retrying, not a new one for every attempt.
        if (tries === 0) toast.error(`${latest.current.failure}. Trying again…`, { id: "record-load" });
        setFailing(true);
        timer = setTimeout(() => attempt(tries + 1), LOAD_RETRY_DELAYS_MS[Math.min(tries, LOAD_RETRY_DELAYS_MS.length - 1)]);
      });
    };
    attempt(0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [load]);

  return failing;
}
