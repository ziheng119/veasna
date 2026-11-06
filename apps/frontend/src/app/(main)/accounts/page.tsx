"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarDays, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Account, createDayAccount, deleteDayAccount, getAccounts, updateDayAccount } from "@/lib/api/accounts/accounts";
import { formatDayLabel } from "@/helper/format_date";
import { todayIso } from "@/components/shared/PrintReferralsDialog";

const LABEL = "flex flex-col gap-1.5 text-sm font-medium";

/**
 * Admin only (lib/permissions.ts). Screening-day accounts: one username and password per screening
 * day, shared by every volunteer that day. Such an account sees only the patients queued on its
 * day (and their earlier visits), and can save only on that day.
 */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", password: "", screening_date: todayIso() });
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Account | null>(null);
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
      setForm(previous => ({ ...previous, username: "", password: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to create the account.");
    } finally {
      setCreating(false);
    }
  };

  const change = async (account: Account, changes: Parameters<typeof updateDayAccount>[1], done: string) => {
    setBusyId(account.id);
    try {
      await updateDayAccount(account.id, changes);
      toast.success(done);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to change the account.");
    } finally {
      setBusyId(null);
    }
  };

  const changePassword = (account: Account) => {
    const password = window.prompt(`New password for ${account.username}`);
    if (password) void change(account, { password }, `Password changed for ${account.username}.`);
  };
  const changeDate = (account: Account) => {
    const date = window.prompt(`Screening date for ${account.username} (YYYY-MM-DD)`, account.screening_date ?? "");
    if (date) void change(account, { screening_date: date.trim() }, `${account.username} is now for ${formatDayLabel(date.trim())}.`);
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
  const fixedAccounts = accounts?.filter(account => !account.screening_date && account.is_active) ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Make one account for each screening day and give it to everyone working that day. It shows only the
          patients queued on that day, with their earlier visits, and can save only on that day.
        </p>
      </header>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>New screening-day account</CardTitle>
          <CardDescription>For example dec13village with the password ilovebtb, for 13 December.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <label className={LABEL}>Username
              <Input required autoComplete="off" value={form.username} placeholder="dec13village"
                onChange={event => setForm(previous => ({ ...previous, username: event.target.value }))} />
            </label>
            <label className={LABEL}>Password
              <Input required autoComplete="new-password" value={form.password} minLength={4}
                onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} />
            </label>
            <label className={LABEL}>Screening date
              <Input required type="date" value={form.screening_date}
                onChange={event => setForm(previous => ({ ...previous, screening_date: event.target.value }))} />
            </label>
            <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">The password is shown here as you type so you can read it out. Anyone with it can sign in.</p>
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
          {dayAccounts.map(account => (
            <div key={account.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{account.username}</p>
                <p className="text-sm text-muted-foreground">{formatDayLabel(account.screening_date!)}</p>
              </div>
              <Badge variant={account.is_active ? "active" : "inactive"}>{account.is_active ? "Can sign in" : "Disabled"}</Badge>
              <Button type="button" variant="ghost" size="sm" disabled={busyId === account.id} onClick={() => changeDate(account)}>
                <CalendarDays className="size-4" /> Date
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busyId === account.id} onClick={() => changePassword(account)}>
                <KeyRound className="size-4" /> Password
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busyId === account.id}
                onClick={() => change(account, { is_active: !account.is_active }, `${account.username} ${account.is_active ? "can no longer sign in" : "can sign in again"}.`)}>
                {account.is_active ? "Disable" : "Enable"}
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${account.username}`} disabled={busyId === account.id}
                onClick={() => setRemoving(account)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
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
            <p key={account.id}><span className="font-medium">{account.username}</span> · {account.role === "admin" ? "Admin: everything" : "User: view all days, enter new records"}</p>
          ))}
        </CardContent>
      </Card>

      <ConfirmDialog open={removing !== null} busy={busyId === removing?.id} title={`Remove ${removing?.username ?? "account"}?`}
        description="It can no longer sign in. If it entered any records, it is disabled instead, so the records still show who entered them."
        confirmLabel="Remove" onConfirm={remove} onCancel={() => setRemoving(null)} />
    </div>
  );
}
