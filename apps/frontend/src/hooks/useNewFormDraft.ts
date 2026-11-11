"use client";

import { useEffect, useRef, useState } from "react";
import { readDraft, removeDraft, removeExpiredDrafts, writeDraft } from "@/lib/drafts";
import type { LiveRecord } from "@/components/shared/LiveRecord";

// Keeps unsaved typing on a form for a new record (Registration: there is no saved visit yet) as a
// draft in this browser, so a dropped connection, a sign-out or a reload doesn't lose it. When the
// form opens with a draft under `key`, it is put back with LiveRecordNotice's "restored" note and
// Discard. The draft follows the form while it differs from `empty`, and goes once the form is
// empty again (e.g. reset after it was saved). `key` is null until it is known (signed-in account).
export function useNewFormDraft<T>(key: string | null, values: T, empty: T, restore: (values: T) => void): LiveRecord {
  const current = JSON.stringify(values);
  const blank = JSON.stringify(empty);
  const [restored, setRestored] = useState<{ key: string; seq: number } | null>(null);
  // The key whose earlier draft has been looked at: until then, nothing is written over it.
  const checked = useRef<string | null>(null);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    if (!key || checked.current === key) return;
    checked.current = key;
    removeExpiredDrafts();
    const earlier = readDraft(key);
    if (!earlier) return;
    restoreRef.current(JSON.parse(earlier.values) as T);
    setRestored(previous => ({ key, seq: (previous?.seq ?? 0) + 1 }));
  }, [key]);

  useEffect(() => {
    if (!key || checked.current !== key) return;
    if (current === blank) removeDraft(key);
    else writeDraft(key, { values: current, base: blank, savedAt: Date.now() });
  }, [key, current, blank, restored]);

  const noop = () => {};
  return {
    // The note goes once the form is emptied (saved, or Discard).
    notice: restored?.key === key && current !== blank ? "restored" : null,
    seq: restored?.seq ?? 0,
    showSaved: noop,
    keepMine: noop,
    discardDraft: () => {
      if (key) removeDraft(key);
      setRestored(null);
      restoreRef.current(JSON.parse(blank) as T);
    },
  };
}
