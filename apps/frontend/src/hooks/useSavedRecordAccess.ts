"use client";
import { useCallback, useState } from "react";
import { useUserStore } from "@/stores/useUserStore";

/** Fail closed until this record loads; a late response for another visit cannot unlock it. */
export function useSavedRecordAccess(recordKey: number) {
  const role = useUserStore((state) => state.user?.role);
  const [record, setRecord] = useState<{ key: number; exists: boolean } | null>(
    null,
  );
  const loaded = record?.key === recordKey;
  const editable =
    loaded && (role === "admin" || (role === "user" && !record.exists));
  const markSaved = useCallback(
    (exists = true) => setRecord({ key: recordKey, exists }),
    [recordKey],
  );
  return { editable, markSaved };
}
