"use client";

import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveList } from "@/hooks/useLiveList";
import { cancelPrescription, dispensePrescription, getLocationPrescriptions } from "@/lib/api/pharmacy/prescriptions";
import { Prescription } from "@/lib/types/prescription";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

interface Props {
  locationId: number;
  // Called after a dispense or cancel, so stock figures elsewhere on the page refresh.
  onStockChanged: () => void;
}

/** Prescriptions waiting at the pharmacy. Dispensing finalises the stock deduction. */
export default function PendingPrescriptions({ locationId, onStockChanged }: Props) {
  const token = useUserStore((state) => state.user?.token);
  const isAdmin = useUserStore((state) => state.user?.role === "admin");
  const load = useCallback(async (signal: AbortSignal): Promise<Prescription[]> => {
    if (!token) return [];
    return getLocationPrescriptions(locationId, "pending", signal);
  }, [locationId, token]);
  const { data: pending, refresh, loaded } = useLiveList(load);
  const [busy, setBusy] = useState<number | null>(null);

  const act = async (prescription: Prescription, action: "dispense" | "cancel") => {
    const label = `${prescription.quantity} × ${prescription.drug_name} for ${prescription.english_name || "this patient"}`;
    if (action === "cancel" && !window.confirm(`Cancel ${label}? The reserved stock is released.`)) return;
    setBusy(prescription.id);
    try {
      if (action === "dispense") {
        await dispensePrescription(prescription.id);
        toast.success(`Dispensed ${label}.`);
      } else {
        await cancelPrescription(prescription.id);
        toast.success("Prescription cancelled.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setBusy(null);
      await refresh();
      onStockChanged();
    }
  };

  if (loaded && pending.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-muted-foreground">No prescriptions waiting to be dispensed.</p>;
  }

  return (
    <div className="overflow-x-auto">
      {!isAdmin && (
        <p className="px-6 pt-3 text-xs text-muted-foreground">Dispensing changes stock, so it needs an admin login.</p>
      )}
      <table className="w-full min-w-[720px]">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">Queue</th>
            <th className="px-4 py-3">Patient</th>
            <th className="px-4 py-3">Drug</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3">Prescribed</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card text-sm">
          {pending.map((p) => (
            <tr key={p.id} className={cn("align-top", busy === p.id && "opacity-50")}>
              <td className="px-4 py-3 text-lg font-bold tabular-nums">{p.queue_no}</td>
              <td className="px-4 py-3">
                <span className="block font-medium">{p.english_name || "Unknown name"}</span>
                {p.khmer_name && <span className="block text-xs text-muted-foreground">{p.khmer_name}</span>}
              </td>
              <td className="px-4 py-3">
                <span className="block font-medium">{p.drug_name}</span>
                {p.instructions && <span className="block text-xs text-muted-foreground">{p.instructions}</span>}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{p.quantity}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {p.visit_date} {time(p.prescribed_at)}
                {p.prescribed_by && <span className="block">by {p.prescribed_by}</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-muted-foreground hover:text-destructive"
                    disabled={!isAdmin || busy !== null}
                    title="Cancel and release the reserved stock"
                    onClick={() => act(p, "cancel")}
                  >
                    <X className="size-4" aria-hidden="true" /> Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    disabled={!isAdmin || busy !== null}
                    title="Hand the drug over and take it off the stock count"
                    onClick={() => act(p, "dispense")}
                  >
                    <Check className="size-4" aria-hidden="true" /> Dispense
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
