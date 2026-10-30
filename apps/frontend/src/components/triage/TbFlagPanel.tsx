"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TbBadge from "@/components/shared/TbBadge";
import { TB_RED_FLAGS, tbRedFlagLabel } from "@/constants/tb";
import { getTbScreening, setTbFlag, TbScreening } from "@/lib/api/tb/tb";
import { useUserStore } from "@/stores/useUserStore";

interface Props {
  visitId: number;
  // Called after the flag is set or removed, so the queue can show or hide the red TB marker.
  onChanged: (flagged: boolean) => void;
}

/** Flag suspected TB at triage. Anyone can flag; only an admin can remove a flag. */
export default function TbFlagPanel({ visitId, onChanged }: Props) {
  const token = useUserStore((state) => state.user?.token);
  const isAdmin = useUserStore((state) => state.user?.role === "admin");
  const [screening, setScreening] = useState<TbScreening | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoaded(false);
    getTbScreening(visitId, token)
      .then((data) => { if (!cancelled) setScreening(data); })
      .catch((err) => { if (!cancelled) console.error("Failed to load TB flag:", err); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [visitId, token]);

  const flagged = Boolean(screening?.flagged);

  const save = async (flag: boolean) => {
    if (!token) return;
    if (!flag && !window.confirm("Remove the TB flag? The patient's red TB marker will be removed from every queue.")) return;
    setSaving(true);
    try {
      await setTbFlag(visitId, flag ? { flagged: true, red_flags: redFlags, notes } : { flagged: false }, token);
      setScreening(await getTbScreening(visitId, token));
      setOpen(false);
      onChanged(flag);
      if (flag) toast.error("Flagged for suspected TB. The patient is now marked red in every queue.", { duration: 6000 });
      else toast.success("TB flag removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update TB flag");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  if (flagged && screening) {
    return (
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border-2 border-red-500 bg-red-50 p-3 dark:bg-red-500/10">
        <div className="min-w-0 space-y-1 text-sm">
          <p className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
            <TbBadge /> Suspected TB
          </p>
          {screening.red_flags.length > 0 && (
            <p className="text-foreground">{screening.red_flags.map(tbRedFlagLabel).join(" · ")}</p>
          )}
          {screening.flag_notes && <p className="whitespace-pre-wrap text-muted-foreground">{screening.flag_notes}</p>}
        </div>
        {isAdmin && (
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => save(false)}>
            Remove TB flag
          </Button>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <ShieldAlert className="size-4 text-red-600" aria-hidden="true" />
          TB red flags? Flag the patient so doctors see them in every queue.
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Flag suspected TB
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-3 rounded-lg border-2 border-red-500/60 bg-red-50/60 p-3 dark:bg-red-500/10">
      <p className="text-sm font-semibold text-red-700 dark:text-red-300">Flag suspected TB</p>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {TB_RED_FLAGS.map((flag) => (
          <div key={flag.id} className="flex items-center space-x-2">
            <Checkbox
              id={`triage-tb-${flag.id}`}
              checked={redFlags.includes(flag.id)}
              onCheckedChange={(checked) =>
                setRedFlags((prev) =>
                  checked === true
                    ? TB_RED_FLAGS.map((f) => f.id).filter((id) => id === flag.id || prev.includes(id))
                    : prev.filter((id) => id !== flag.id)
                )
              }
              className="border-border bg-background data-[state=checked]:border-destructive data-[state=checked]:bg-destructive"
            />
            <Label htmlFor={`triage-tb-${flag.id}`} className="text-muted-foreground">{flag.label}</Label>
          </div>
        ))}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="TB notes for the doctor (e.g. how long the cough has lasted)"
        rows={2}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={saving || redFlags.length === 0} onClick={() => save(true)}>
          {saving ? "Saving..." : "Flag suspected TB"}
        </Button>
      </div>
    </div>
  );
}
