"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import PermissionPicker from "@/components/accounts/PermissionPicker";
import AccountEditDialog, { AccountChanges, AccountEdit, MIN_PASSWORD } from "@/components/accounts/AccountEditDialog";
import { Account, createDayAccount, deleteDayAccount, getAccounts, updateDayAccount } from "@/lib/api/accounts/accounts";
import { DEFAULT_PERMISSIONS, Permission, permissionLabel, permissionsOf } from "@/lib/permissions";
import { formatDayLabel } from "@/helper/format_date";
import { hostToday } from "@/stores/useHostClockStore";

const LABEL = "flex flex-col gap-1.5 text-sm font-medium";

/**
 * Admin only (lib/permissions.ts). Screening-day accounts: one username and password per screening
 * day, shared by every volunteer that day, with what the account may do. Such an account sees the
 * patients queued on its day (and their earlier visits), and can save only on that day.
 */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ username: string; password: string; screening_date: string; permissions: Permission[] }>(
    () => ({ username: "", password: "", screening_date: hostToday(), permissions: [...DEFAULT_PERMISSIONS] }));
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Account | null>(null);
  // The date, password or permissions pop-up; kept after closing while it fades out.
  const [editing, setEditing] = useState<{ account: Account; edit: AccountEdit; open: boolean } | null>(null);
  const openEdit = (account: Account, edit: AccountEdit) => setEditing({ account, edit, open: true });
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setAccounts(await getAccounts());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load accounts.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      const account = await createDayAccount({ ...form, username: form.username.trim() });
      toast.success(`${account.username} can sign in for the screening on ${formatDayLabel(account.screening_date!)}.`);
      // The permissions stay ticked: the next day's account usually needs the same.
      setForm(previous => ({ ...previous, username: "", password: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create the account.");
    } finally {
      setCreating(false);
    }
  };

  // Enable or disable, straight from the list.
  const setActive = async (account: Account, active: boolean) => {
    setBusyId(account.id);
    try {
      await updateDayAccount(account.id, { is_active: active });
      toast.success(`${account.username} ${active ? "can sign in again" : "can no longer sign in"}.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to change the account.");
    } finally {
      setBusyId(null);
    }
  };

  // From the date, password or permissions pop-up: a failure is shown there, which stays open.
  const saveEdit = async (account: Account, changes: AccountChanges) => {
    const updated = await updateDayAccount(account.id, changes);
    toast.success(
      changes.screening_date ? `${updated.username} is now for ${formatDayLabel(updated.screening_date!)}.`
      : changes.password !== undefined ? `Password changed for ${updated.username}.`
      : `Permissions saved for ${updated.username}.`);
    await load();
  };

  const remove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    try {
      const result = await deleteDayAccount(removing.id);
      toast.success(result.deleted
        ? `${removing.username} was removed.`
        : `${removing.username} entered records, so it was disabled instead of removed. Its records still show who entered them.`);
      setRemoving(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to remove the account.");
    } finally {
      setBusyId(null);
    }
  };

  const dayAccounts = accounts?.filter(account => account.screening_date) ?? [];
  // After its day an account can no longer sign in; what it saved stays (backend utils/dayScope.js).
  const today = hostToday();
  const fixedAccounts = accounts?.filter(account => !account.screening_date && account.is_active) ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Make one account for each screening day and give it to everyone working that day. Choose what it may do;
          it can save only on its day. Once the day is over it signs out and can no longer sign in; what it saved stays in the records.
        </p>
      </header>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>New screening-day account</CardTitle>
          <CardDescription>For example dec13village with the password ilovebtb, for 13 December.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className={LABEL}>Username
                <Input required autoComplete="off" value={form.username} placeholder="dec13village"
                  onChange={event => setForm(previous => ({ ...previous, username: event.target.value }))} />
              </label>
              <label className={LABEL}>Password
                <Input required autoComplete="new-password" value={form.password} minLength={MIN_PASSWORD}
                  onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} />
              </label>
              <label className={LABEL}>Screening date
                <Input required type="date" value={form.screening_date}
                  onChange={event => setForm(previous => ({ ...previous, screening_date: event.target.value }))} />
              </label>
            </div>
            <fieldset className="rounded-lg border border-border bg-muted/30 px-3 pb-2 pt-1">
              <legend className="px-1 text-sm font-medium">This account may</legend>
              <PermissionPicker id="new-account" value={form.permissions} disabled={creating}
                onChange={permissions => setForm(previous => ({ ...previous, permissions }))} />
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">The password is shown here as you type so you can read it out. Anyone with it can sign in.</p>
              <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create account"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <div role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={load}>Retry</button></div>}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Screening-day accounts</CardTitle>
          <CardDescription>Newest screening first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {accounts && dayAccounts.length === 0 && <p className="text-sm text-muted-foreground">No screening-day accounts yet.</p>}
          {dayAccounts.map(account => {
            const permissions = permissionsOf(account);
            const busy = busyId === account.id;
            return (
              <div key={account.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{account.username}</p>
                  <p className="text-sm text-muted-foreground">{formatDayLabel(account.screening_date!)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {permissions.length ? permissions.map(permissionLabel).join(" · ") : "Station queues only"}
                  </p>
                </div>
                <Badge variant={account.is_active && account.screening_date! >= today ? "active" : "inactive"}>
                  {!account.is_active ? "Disabled" : account.screening_date! < today ? "Day ended" : "Can sign in"}
                </Badge>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => openEdit(account, "date")}>
                  <CalendarDays className="size-4" /> Date
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => openEdit(account, "password")}>
                  <KeyRound className="size-4" /> Password
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => openEdit(account, "permissions")}>
                  <ShieldCheck className="size-4" /> Permissions
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={busy}
                  onClick={() => void setActive(account, !account.is_active)}>
                  {account.is_active ? "Disable" : "Enable"}
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8 hover:bg-destructive/10" aria-label={`Remove ${account.username}`} disabled={busy}
                  onClick={() => setRemoving(account)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Fixed accounts</CardTitle>
          <CardDescription>
            These see every day. Reset them with <code>npm run setup:accounts</code> on the host laptop.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {fixedAccounts.map(account => (
            <p key={account.id}><span className="font-medium">{account.username}</span> · {account.role === "admin"
              ? "Admin: everything"
              : `User: ${permissionsOf(account).map(permissionLabel).join(", ") || "station queues only"}`}</p>
          ))}
        </CardContent>
      </Card>

      <AccountEditDialog open={!!editing?.open} account={editing?.account ?? null} edit={editing?.edit ?? "date"}
        onSave={saveEdit} onClose={() => setEditing(previous => previous && { ...previous, open: false })} />
      <ConfirmDialog open={removing !== null} busy={busyId === removing?.id} title={`Remove ${removing?.username ?? "account"}?`}
        description="It can no longer sign in. If it entered any records, it is disabled instead, so the records still show who entered them."
        confirmLabel="Remove" destructive onConfirm={remove} onCancel={() => setRemoving(null)} />
    </div>
  );
}
