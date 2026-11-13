// Unsaved form drafts, kept in this browser so typing survives a dropped connection, a sign-out or a
// reload (components/shared/LiveRecord.tsx, hooks/useNewFormDraft.ts). One per account, visit and form
// (or account and form for Registration); kept for a day.
// Storage can be unavailable (private browsing, blocked site data): drafts are then simply not kept.

const PREFIX = "veasna-draft:";
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface Draft {
  // What was typed, and what the saved record was when typing started (both as JSON).
  values: string;
  base: string;
  savedAt: number;
}

export const draftKey = (userId: number, visitId: number, form: string) => `${PREFIX}${userId}:${visitId}:${form}`;
// A form for a new record, which has no visit yet: one per account (Registration).
export const newRecordDraftKey = (userId: number, form: string) => `${PREFIX}${userId}:new:${form}`;

export function removeDraft(key: string): void {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

export function writeDraft(key: string, draft: Draft): void {
  try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* storage unavailable or full */ }
}

// The draft under `key`, unless there is none, it is unreadable or it is more than a day old.
export function readDraft(key: string, now = Date.now()): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (typeof draft?.values === "string" && typeof draft.base === "string" && now - draft.savedAt < DRAFT_MAX_AGE_MS) return draft;
  } catch { /* storage unavailable or not a draft */ }
  removeDraft(key);
  return null;
}

// Clears every draft older than a day, for any account.
export function removeExpiredDrafts(now = Date.now()): void {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => key?.startsWith(PREFIX) ?? false);
    for (const key of keys) readDraft(key, now);
  } catch { /* storage unavailable */ }
}
