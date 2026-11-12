"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PermissionPicker from "./PermissionPicker";
import { Account } from "@/lib/api/accounts/accounts";
import { Permission, permissionsOf } from "@/lib/permissions";
import { formatDayLabel } from "@/helper/format_date";
import { hostToday } from "@/stores/useHostClockStore";
import { ENTER_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const MIN_PASSWORD = 4;

export type AccountEdit = "date" | "password" | "permissions";
export type AccountChanges = { screening_date?: string; password?: string; permissions?: Permission[] };

interface Props {
  open: boolean;
  // Kept after closing, so the pop-up keeps its content while it fades out.
  account: Account | null;
  edit: AccountEdit;
  // Resolves when saved; rejects with the host's message, which is shown in the dialog.
  onSave: (account: Account, changes: AccountChanges) => Promise<void>;
  onClose: () => void;
}

const COPY: Record<AccountEdit, { title: string; icon: typeof KeyRound; save: string }> = {
  date: { title: "Change screening date", icon: CalendarDays, save: "Save date" },
  password: { title: "Change password", icon: KeyRound, save: "Save password" },
  permissions: { title: "Change permissions", icon: ShieldCheck, save: "Save permissions" },
};

/**
 * The admin's pop-up for changing one screening-day account's date, password or permissions, in
 * place of the browser's own prompt. Problems show in the pop-up, which stays open to fix them.
 */
export default function AccountEditDialog({ open, account, edit, onSave, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open && account !== null} onOpenChange={next => { if (!next && !busy) onClose(); }}>
      <DialogContent className={edit === "permissions" ? "sm:max-w-2xl" : "sm:max-w-md"}>
        {/* Keyed so each opening starts from the account's saved values. */}
        {account && <EditForm key={`${account.id}:${edit}`} account={account} edit={edit} busy={busy} setBusy={setBusy}
          onSave={onSave} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ account, edit, busy, setBusy, onSave, onClose }: Omit<Props, "account" | "open"> & {
  account: Account; busy: boolean; setBusy: (busy: boolean) => void;
}) {
  const today = hostToday();
  const [date, setDate] = useState(account.screening_date ?? today);
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>(() => permissionsOf(account));
  const [error, setError] = useState("");
  const { title, icon: Icon, save } = COPY[edit];

  const problem =
    edit === "date" ? (!date ? "Choose the screening date." : "")
    : edit === "password" ? (password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters (${password.length} so far).` : "")
    : "";
  const unchanged =
    edit === "date" ? date === account.screening_date
    : edit === "permissions" ? permissions.join() === permissionsOf(account).join()
    : false;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem || unchanged || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSave(account, edit === "date" ? { screening_date: date } : edit === "password" ? { password } : { permissions });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
          {title}
        </DialogTitle>
        <DialogDescription>
          {edit === "date" && <>For <span className="font-medium text-foreground">{account.username}</span>, now {formatDayLabel(account.screening_date ?? today)}. It shows only the patients queued on this day and can save only on it.</>}
          {edit === "password" && <>A new password for <span className="font-medium text-foreground">{account.username}</span>. Devices signed in with it stay signed in.</>}
          {edit === "permissions" && <>What <span className="font-medium text-foreground">{account.username}</span> may do. Devices signed in with it pick up the change on their next page change.</>}
        </DialogDescription>
      </DialogHeader>

      {edit === "date" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">Screening date
          <Input type="date" required autoFocus value={date} onChange={event => { setDate(event.target.value); setError(""); }} />
          {date && date < today && (
            <span className={cn("text-xs font-normal text-amber-700 dark:text-amber-300", ENTER_FAST)}>
              This day is over, so the account won&apos;t be able to sign in.
            </span>
          )}
        </label>
      )}
      {edit === "password" && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">New password
          <Input autoFocus autoComplete="new-password" value={password} minLength={MIN_PASSWORD}
            aria-invalid={password.length > 0 && !!problem}
            onChange={event => { setPassword(event.target.value); setError(""); }} />
          <span className={cn("text-xs font-normal", password.length > 0 && problem ? "text-destructive" : "text-muted-foreground")}>
            {password.length > 0 && problem ? problem : "Shown as you type so you can read it out."}
          </span>
        </label>
      )}
      {edit === "permissions" && (
        <PermissionPicker id={`edit-${account.id}`} value={permissions} disabled={busy}
          onChange={next => { setPermissions(next); setError(""); }} />
      )}

      {error && <p role="alert" className={cn("rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive", ENTER_FAST)}>{error}</p>}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy || !!problem || unchanged}>{busy ? "Saving..." : save}</Button>
      </DialogFooter>
    </form>
  );
}
