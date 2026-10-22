"use client"

import { calculateAge } from "@/helper/calculate_age";
import { postReferral } from "@/lib/api/visit/postReferral";
import { Referral, Signature } from "@/lib/types/consultation";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import GlassButton from "../shared/GlassButton";
import SignaturePad from "./SignaturePad";
import { referralDocumentHtml } from "./ReferralDocument";
import { deleteReferral } from "@/lib/api/visit/deleteReferral";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";

interface Props {
  patient: QueuedPatient;
  patientInfo: PatientInfo;
  retrievedReferral: Referral | null
  onClose: () => void;
  onSaved?: (referral: Referral) => void;
  onDeleted?: () => void;
}

export default function ReferralForm({ patient, patientInfo, retrievedReferral, onClose, onSaved, onDeleted }: Props) {

  const [referralDate, setReferralDate] = useState<string>(() => {
    if (retrievedReferral?.referralDate) return retrievedReferral.referralDate;
    // Use the device's local calendar date, not UTC (which can be yesterday on a clinic morning).
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  })
  const [referralType, setReferralType] = useState<string[]>(
    retrievedReferral?.referralType ?? []
  );
  const [illness, setIllness] = useState<string>(retrievedReferral? retrievedReferral.illness : "")
  const [duration, setDuration] = useState<string>(retrievedReferral ? retrievedReferral.duration : "")
  const [reason, setReason] = useState<string>(retrievedReferral ? retrievedReferral.reason : "")

  const user = useUserStore((state) => state.user)

  const readOnly = user?.role !== "admin" && retrievedReferral !== null;
  const [signature, setSignature] = useState<Signature | null>(retrievedReferral?.signature ?? null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const handleDelete = async () => {
    if (user?.role !== "admin" || saving || !retrievedReferral || !confirmDelete) return;
    setDeleteError("");
    setSaving(true);
    try {
      await deleteReferral(patient.visit_id);
      setConfirmDelete(false);
      onDeleted?.();
      toast.success("Referral deleted");
      onClose();
    } catch (error) {
      console.error("Referral deletion failed:", error);
      setDeleteError("Unable to delete referral. Please try again.");
      toast.error("Unable to delete referral. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  // Keep saved strokes editable; only explicit clearing removes the signature.
  const handleSave = async (print = false) => {
    if (saving || readOnly) return;
    if (print && !signature) { toast.error("Please sign this referral before printing."); return; }
    const printWindow = print ? window.open("", "_blank") : null;
    if (print && !printWindow) { toast.error("Allow pop-ups to print this referral."); return; }
    setSaving(true);
    const data: Referral = {
      referralDate: referralDate,
      referralType: referralType,
      illness: illness,
      duration: duration,
      reason: reason,
      signature,
    }

    try {
      const saved = await postReferral(data, patient.visit_id);
      const savedReferral: Referral = { ...data, signature: saved.signature, signerName: saved.signer_name, signerId: saved.signer_id, signedAt: saved.signed_at };
      onSaved?.(savedReferral);
      toast.success("Referral saved");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(referralDocumentHtml(savedReferral, patientInfo, patient.visit_id));
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
      onClose();
    } catch (error) {
      console.error("Referral save error:", error)
      printWindow?.close();
      toast.error("Unable to save referral. Please try again.")
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "mt-2 block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="text-sm text-foreground">
      <header className="border-b border-border px-6 py-5 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Project Battambang</p>
        <h2 className="mt-1 text-xl font-semibold">Patient referral</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose destinations, add clinical details, then sign.</p>
      </header>
      {readOnly && <div className="px-6 py-3">
        <p>Read-only. Only an admin can change a saved referral.</p>
        <GlassButton type="button" onClick={() => {
          const popup = window.open("", "_blank");
          if (!popup) { toast.error("Allow pop-ups to print this referral."); return; }
          popup.document.open();
          popup.document.write(referralDocumentHtml(retrievedReferral!, patientInfo, patient.visit_id));
          popup.document.close(); popup.focus(); popup.print();
        }}>Print saved referral</GlassButton>
      </div>}
      <form onSubmit={event => event.preventDefault()}>
        <fieldset disabled={saving || readOnly} className="space-y-6 px-6 py-6 sm:px-8">
          <section className="grid gap-5 sm:grid-cols-[1fr_13rem]">
            <div className="min-w-0 rounded-xl bg-muted/30 p-4">
              <h3 className="mb-3 font-semibold">Patient details</h3>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3 break-words">
                {[["Name", patientInfo.english_name || "N/A"], ["Sex", patientInfo.sex || "N/A"],
                  ["Age", patientInfo.date_of_birth ? calculateAge(patientInfo.date_of_birth) : "N/A"],
                  ["Address", patientInfo.address || "N/A"]].map(([label, value]) => (
                  <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>
                ))}
              </dl>
            </div>
            <label className="font-medium">Referral date
              <input type="date" className={inputClass} value={referralDate} onChange={event => setReferralDate(event.target.value)} />
            </label>
          </section>

          <fieldset>
            <legend className="mb-1 font-semibold">Referral destinations</legend>
            <p className="mb-3 text-xs text-muted-foreground">Select all that apply. Only selected destinations appear on the referral.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {["MongKol Borey Hospital", "Poipett Referral Hospital", "SEVA", "Optometrist", "Dentist", "Bong Bondol"].map(destination => (
                <label key={destination} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors motion-reduce:transition-none ${referralType.includes(destination) ? "border-foreground/25 bg-muted/60" : "border-border hover:bg-muted/30"}`}>
                  <input type="checkbox" name="referral" value={destination} checked={referralType.includes(destination)}
                    className="size-4 shrink-0 accent-foreground"
                    onChange={event => setReferralType(previous => event.target.checked ? [...previous, destination] : previous.filter(item => item !== destination))} />
                  <span>{destination}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <section className="space-y-4">
            <h3 className="font-semibold">Clinical details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="font-medium">Condition / illness
                <input className={inputClass} placeholder="Describe the condition" value={illness} onChange={event => setIllness(event.target.value)} />
              </label>
              <label className="font-medium">Duration
                <input className={inputClass} placeholder="e.g. 2 weeks" value={duration} onChange={event => setDuration(event.target.value)} />
              </label>
            </div>
            <label className="block font-medium">Reason for referral
              <textarea className={`${inputClass} min-h-28 resize-y`} rows={4} value={reason} onChange={event => setReason(event.target.value)} />
            </label>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">Signing as <span className="font-medium text-foreground">{user?.username}</span></p>
            <SignaturePad value={signature} onChange={setSignature} disabled={saving} />
            <p className="text-xs text-muted-foreground">Your saved signature stays in this box. Draw to add strokes, or clear it to start again. Save referral to keep your changes.</p>
            {retrievedReferral?.signerName && <p className="text-xs text-muted-foreground">Saved signature by {retrievedReferral.signerName}. An unchanged signature keeps its original signer.</p>}
          </section>
          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
            {retrievedReferral && user?.role === "admin" && <Dialog open={confirmDelete} onOpenChange={open => {
              if (saving) return;
              setDeleteError("");
              setConfirmDelete(open);
            }}>
              <DialogTrigger asChild>
                <GlassButton type="button" disabled={saving}
                  className="mr-auto bg-none bg-rose-100 text-rose-900 ring-rose-200 hover:bg-rose-200">
                  Delete referral
                </GlassButton>
              </DialogTrigger>
              <DialogContent className="rounded-2xl border-border bg-card sm:max-w-md" showCloseButton={!saving}
                onOpenAutoFocus={event => { event.preventDefault(); cancelDeleteRef.current?.focus(); }}
                onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}
                onInteractOutside={event => event.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>Delete referral?</DialogTitle>
                  <DialogDescription>
                    Delete the referral for {patientInfo.english_name || "this patient"}?
                    This also removes its saved signature and cannot be undone.
                    Consultation notes and prescriptions will be kept.
                  </DialogDescription>
                </DialogHeader>
                {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
                <DialogFooter>
                  <GlassButton ref={cancelDeleteRef} type="button" disabled={saving} onClick={() => setConfirmDelete(false)}>Cancel</GlassButton>
                  <GlassButton type="button" disabled={saving} onClick={() => void handleDelete()}
                    className="bg-none bg-rose-100 text-rose-900 ring-rose-200 hover:bg-rose-200">
                    {saving ? "Deleting..." : "Confirm deletion"}
                  </GlassButton>
                </DialogFooter>
              </DialogContent>
            </Dialog>}
            <GlassButton type="button" disabled={saving} onClick={() => void handleSave()}>{saving ? "Saving..." : "Save referral"}</GlassButton>
            <GlassButton type="button" disabled={saving} onClick={() => void handleSave(true)}>Save &amp; print referral</GlassButton>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
