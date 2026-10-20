"use client"

import { calculateAge } from "@/helper/calculate_age";
import { postReferral } from "@/lib/api/visit/postReferral";
import { Referral, Signature } from "@/lib/types/consultation";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";
import { useState } from "react";
import toast from "react-hot-toast";
import GlassButton from "../shared/GlassButton";
import SignaturePad, { SignatureImage } from "./SignaturePad";
import { referralDocumentHtml } from "./ReferralDocument";

interface Props {
  patient: QueuedPatient;
  patientInfo: PatientInfo;
  retrievedReferral: Referral | null
  onClose: () => void;
  onSaved?: (referral: Referral) => void;
}

export default function ReferralForm({ patient, patientInfo, retrievedReferral, onClose, onSaved }: Props) {

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

  const [signature, setSignature] = useState<Signature | null>(null);
  const [saving, setSaving] = useState(false);
  // A fresh signature confirms the current user's edited content; never reuse another user's signature.
  const handleSave = async (print = false) => {
    if (saving) return;
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
      <form onSubmit={event => event.preventDefault()} onChange={() => setSignature(null)}>
        <fieldset disabled={saving} className="space-y-6 px-6 py-6 sm:px-8">
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
            <p className="text-xs text-muted-foreground">Sign after completing your edits. Editing clears the signature. Unsigned drafts can be saved; printing requires a signature.</p>
            {retrievedReferral?.signerName && <p className="text-xs text-muted-foreground">Previously signed by {retrievedReferral.signerName}. Sign again to confirm this version.</p>}
            {retrievedReferral?.signature && <details>
              <summary className="cursor-pointer">View saved signature</summary>
              <div className="h-24 max-w-xs"><SignatureImage value={retrievedReferral.signature} /></div>
            </details>}
          </section>
          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
            <GlassButton type="button" disabled={saving} onClick={() => void handleSave()}>{saving ? "Saving..." : "Save referral"}</GlassButton>
            <GlassButton type="button" disabled={saving} onClick={() => void handleSave(true)}>Save &amp; print referral</GlassButton>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
