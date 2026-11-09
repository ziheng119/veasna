"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVisitChanges } from "@/hooks/useVisitChanges";
import { ENTER_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useSavedBaseline } from "./StationFlow";

// Keeps an open form in step with saves made for the same visit elsewhere: on another device, or by
// another volunteer signed in to the same account. When a live notice says the visit changed
// (RealtimeConnection), the form's record is loaded again and compared with what the form last
// loaded or saved:
// - the same (e.g. this form's own save): nothing happens;
// - different, and nothing typed here since: the form shows the saved version, with a short note;
// - different, and something typed here: what was typed stays, and a notice offers the saved
//   version. Saving here replaces it, as any later save does.
// Only the visit's saved record is shared. What belongs to the signed-in user, such as the signature
// kept for their next referrals (stores/useSavedSignatureStore.ts), stays in their browser tab.

interface Options<T> {
  visitId: number;
  // As for useSaveBeforeNext: changes whenever the form is loaded or saved; null until loaded.
  savedVersion: string | null;
  // What the form would save now.
  values: unknown;
  // Loads the visit's saved record.
  load: (signal: AbortSignal) => Promise<T>;
  // The form values the record would show, in the shape of `values`.
  valuesOf: (data: T) => unknown;
  // Shows the record in the form as saved; must change `savedVersion` (e.g. markSaved()).
  apply: (data: T) => void;
  // Parts of the record outside the form (e.g. the referral beside the consultation notes); always
  // taken from the saved record.
  applyShared?: (data: T) => void;
}

export interface LiveRecord {
  // "updated": the saved version is now shown. "conflict": saved elsewhere while typing here.
  notice: "updated" | "conflict" | null;
  // Bumped for each notice, so the note replays its entrance.
  seq: number;
  // Conflict: show the saved version instead of what was typed here.
  showSaved: () => void;
  // Conflict: keep what was typed here (saving it replaces the other save).
  keepMine: () => void;
}

// How long the "updated" note stays.
const UPDATED_NOTE_MS = 6000;

export function useLiveRecord<T>({ visitId, savedVersion, values, load, valuesOf, apply, applyShared }: Options<T>): LiveRecord {
  const changes = useVisitChanges(visitId);
  const current = JSON.stringify(values);
  const baseline = useSavedBaseline(savedVersion, current);
  const latest = useRef({ current, load, valuesOf, apply, applyShared });
  latest.current = { current, load, valuesOf, apply, applyShared };
  const [state, setState] = useState<{ notice: LiveRecord["notice"]; seq: number; pending?: T }>({ notice: null, seq: 0 });

  useEffect(() => {
    if (changes === 0) return;
    const controller = new AbortController();
    latest.current.load(controller.signal).then((data) => {
      const saved = baseline.current;
      if (controller.signal.aborted || !saved) return;
      const { current: typed, valuesOf: toValues, apply: show, applyShared: showShared } = latest.current;
      showShared?.(data);
      const remote = JSON.stringify(toValues(data));
      if (remote === saved.values) return;
      if (typed === saved.values || typed === remote) {
        show(data);
        setState(previous => ({ notice: typed === remote ? null : "updated", seq: previous.seq + 1 }));
      } else {
        setState(previous => ({ notice: "conflict", seq: previous.seq + 1, pending: data }));
      }
    }).catch((error) => {
      if (!controller.signal.aborted) console.error("Live form refresh failed:", error);
    });
    return () => controller.abort();
  }, [changes, baseline]);

  // Saving here settles a conflict: the later save is kept.
  useEffect(() => {
    setState(previous => (previous.notice === "conflict" ? { notice: null, seq: previous.seq } : previous));
  }, [savedVersion]);

  useEffect(() => {
    if (state.notice !== "updated") return;
    const timer = setTimeout(() => setState(previous => (previous.seq === state.seq ? { notice: null, seq: previous.seq } : previous)), UPDATED_NOTE_MS);
    return () => clearTimeout(timer);
  }, [state.notice, state.seq]);

  return {
    notice: state.notice,
    seq: state.seq,
    showSaved: () => {
      if (state.pending !== undefined) latest.current.apply(state.pending);
      setState(previous => ({ notice: null, seq: previous.seq }));
    },
    keepMine: () => setState(previous => ({ notice: null, seq: previous.seq })),
  };
}

/**
 * What changed elsewhere, at the top of the form. `label` names the part of the form when one page
 * has several (e.g. a Triage section).
 */
export function LiveRecordNotice({ live, label }: { live: LiveRecord; label?: string }) {
  if (live.notice === "updated") {
    return (
      <p key={live.seq} role="status"
        className={cn("flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-200", ENTER_FAST)}>
        <RefreshCw className="size-4 shrink-0 motion-safe:animate-[spin_0.6s_ease-out_1]" aria-hidden="true" />
        {label ? `${label}: updated` : "Updated"} with a save from another device.
      </p>
    );
  }
  if (live.notice === "conflict") {
    return (
      <div key={live.seq} role="alert"
        className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200", ENTER_FAST)}>
        <span className="flex items-center gap-2 font-medium">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {label ? `${label}: saved` : "Saved"} on another device while you were typing.
        </span>
        <span className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 bg-background" onClick={live.showSaved}>Show saved version</Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" onClick={live.keepMine}
            title="Keep what you typed. Saving it replaces the other save.">Keep mine</Button>
        </span>
      </div>
    );
  }
  return null;
}
