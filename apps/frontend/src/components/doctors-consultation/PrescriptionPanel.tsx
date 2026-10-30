"use client";

import { useCallback, useId, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pill, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLiveList } from "@/hooks/useLiveList";
import { getDrugsByLocation } from "@/lib/api/pharmacy/pharmacy";
import { cancelPrescription, createPrescription, getVisitPrescriptions } from "@/lib/api/pharmacy/prescriptions";
import { Drug } from "@/lib/types/drug";
import { Prescription, PRESCRIPTION_STATUS_LABELS } from "@/lib/types/prescription";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserStore } from "@/stores/useUserStore";
import { cn } from "@/lib/utils";

const MAX_MATCHES = 8;

const available = (drug: Drug) => drug.available_count ?? drug.stock_count;

const STATUS_TONES: Record<Prescription["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  dispensed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground line-through",
};

interface Props {
  visitId: number;
  // Free-text prescription saved before prescribing was linked to the pharmacy; shown read-only.
  legacyPrescription?: string;
}

/**
 * Prescribe from the location's pharmacy. Prescribing reserves the stock at once, so it is no
 * longer available to anyone else; the pharmacy dispenses it, or it can be cancelled to release it.
 */
export default function PrescriptionPanel({ visitId, legacyPrescription }: Props) {
  const locationId = useLocationStore((state) => state.currentLocation?.id);
  const token = useUserStore((state) => state.user?.token);
  const isAdmin = useUserStore((state) => state.user?.role === "admin");
  const listId = useId();

  const loadDrugs = useCallback(async (): Promise<Drug[]> => {
    if (!locationId || !token) return [];
    return getDrugsByLocation(locationId);
  }, [locationId, token]);
  const loadPrescriptions = useCallback(async (signal: AbortSignal): Promise<Prescription[]> => {
    if (!token) return [];
    return getVisitPrescriptions(visitId, signal);
  }, [visitId, token]);
  const { data: drugs, refresh: refreshDrugs } = useLiveList(loadDrugs);
  const { data: prescriptions, refresh: refreshPrescriptions } = useLiveList(loadPrescriptions);

  const [query, setQuery] = useState("");
  const [showMatches, setShowMatches] = useState(false);
  const [drug, setDrug] = useState<Drug | null>(null);
  const [quantity, setQuantity] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  // Always judge stock against the latest list, not the copy taken when the drug was picked.
  const selected = drug ? drugs.find((d) => d.id === drug.id) ?? drug : null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? drugs.filter((d) => d.drug_name.toLowerCase().includes(q)) : drugs).slice(0, MAX_MATCHES);
  }, [drugs, query]);

  const qty = Number(quantity);
  const qtyValid = Number.isInteger(qty) && qty > 0;
  const overStock = selected !== null && qtyValid && qty > available(selected);

  const choose = (choice: Drug) => {
    setDrug(choice);
    setQuery(choice.drug_name);
    setShowMatches(false);
  };

  const prescribe = async () => {
    if (!selected || !qtyValid || overStock) return;
    setSaving(true);
    try {
      const result = await createPrescription({ visit_id: visitId, drug_id: selected.id, quantity: qty, instructions });
      toast.success(`Prescribed ${qty} × ${result.drug_name}. ${result.available_count} left available.`);
      setDrug(null);
      setQuery("");
      setQuantity("");
      setInstructions("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to prescribe");
    } finally {
      setSaving(false);
      await Promise.all([refreshDrugs(), refreshPrescriptions()]);
    }
  };

  const cancel = async (prescription: Prescription) => {
    if (!window.confirm(`Cancel ${prescription.quantity} × ${prescription.drug_name}? The reserved stock is released.`)) return;
    try {
      await cancelPrescription(prescription.id);
      toast.success("Prescription cancelled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel prescription");
    } finally {
      await Promise.all([refreshDrugs(), refreshPrescriptions()]);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby={`${listId}-title`}>
      <h3 id={`${listId}-title`} className="flex items-center gap-2 font-semibold">
        <Pill className="size-4" aria-hidden="true" /> Prescription
      </h3>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <div className="relative">
          <Input
            role="combobox"
            aria-expanded={showMatches}
            aria-controls={`${listId}-drugs`}
            aria-label="Search drugs in the pharmacy"
            placeholder={locationId ? "Search drugs in the pharmacy" : "Select a location first"}
            disabled={!locationId}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setDrug(null); setShowMatches(true); }}
            onFocus={() => setShowMatches(true)}
            onBlur={() => setShowMatches(false)}
          />
          {showMatches && (
            <ul id={`${listId}-drugs`} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {drugs.length === 0 ? "No drugs in this location's pharmacy yet." : "No drug matches this search."}
                </li>
              ) : matches.map((d) => {
                const left = available(d);
                return (
                  <li key={d.id} role="option" aria-selected={selected?.id === d.id} aria-disabled={left <= 0}>
                    <button
                      type="button"
                      disabled={left <= 0}
                      // mousedown fires before the input's blur closes the list
                      onMouseDown={(e) => { e.preventDefault(); if (left > 0) choose(d); }}
                      className="flex w-full items-center justify-between gap-3 rounded px-3 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="truncate">{d.drug_name}</span>
                      <span className={cn("shrink-0 text-xs tabular-nums", left <= 0 ? "text-destructive" : "text-muted-foreground")}>
                        {left <= 0 ? "None available" : `${left} available`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          aria-label="Quantity"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-invalid={overStock}
        />
      </div>
      <Input
        aria-label="Instructions"
        placeholder="Instructions (optional), e.g. 1 tablet twice a day for 5 days"
        value={instructions}
        maxLength={500}
        onChange={(e) => setInstructions(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={overStock ? "font-medium text-destructive" : "text-muted-foreground"}>
          {selected
            ? overStock
              ? `Only ${available(selected)} ${selected.drug_name} available. Lower the quantity.`
              : `${available(selected)} ${selected.drug_name} available${selected.reserved_count ? ` (${selected.reserved_count} already reserved)` : ""}.`
            : "Pick a drug from the list to see its stock. Prescribing reserves the stock straight away."}
        </span>
        <Button type="button" size="sm" disabled={!selected || !qtyValid || overStock || saving} onClick={prescribe}>
          {saving ? "Prescribing..." : "Prescribe"}
        </Button>
      </div>

      {prescriptions.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border" aria-label="Prescribed this visit">
          {prescriptions.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{p.quantity} × {p.drug_name}</span>
                {p.instructions && <span className="block text-xs text-muted-foreground">{p.instructions}</span>}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONES[p.status])}>
                {PRESCRIPTION_STATUS_LABELS[p.status]}
              </span>
              {p.status === "pending" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                  disabled={!isAdmin}
                  title={isAdmin ? "Cancel and release the reserved stock" : "Only an admin can cancel a prescription"}
                  onClick={() => cancel(p)}
                >
                  <X className="size-3.5" aria-hidden="true" /> Cancel
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {legacyPrescription?.trim() && (
        <div className="rounded-md border border-dashed border-border p-3 text-xs">
          <p className="font-medium text-muted-foreground">Written prescription (saved before pharmacy-linked prescribing)</p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">{legacyPrescription}</p>
        </div>
      )}
    </section>
  );
}
