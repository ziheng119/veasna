"use client";
import { useCallback, useState } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { canEditSavedData } from "@/lib/permissions";

/**
 * Fail closed until this record loads; a late response for another visit cannot unlock it.
 * Once loaded, every account may save it again (lib/permissions.ts canEditSavedData).
 */
export function useSavedRecordAccess(recordKey: number) {
  const role = useUserStore((state) => state.user?.role);
  // version counts loads and saves, so a form can tell when its values were last saved.
  const [record, setRecord] = useState<{ key: number; exists: boolean; version: number } | null>(
    null,
  );
  const loaded = record?.key === recordKey;
  const editable = loaded && canEditSavedData(role);
  // The record for this key has been saved (e.g. the station's form is done).
  const saved = loaded && record.exists;
  const markSaved = useCallback(
    (exists = true) => setRecord((previous) => ({ key: recordKey, exists, version: (previous?.version ?? 0) + 1 })),
    [recordKey],
  );
  // Changes whenever the record is loaded or saved for this key; null until it has loaded.
  const savedVersion = loaded ? `${recordKey}:${record.version}` : null;
  return { editable, saved, markSaved, savedVersion };
}
