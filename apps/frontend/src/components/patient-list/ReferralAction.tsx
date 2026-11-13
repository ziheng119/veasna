"use client";

import { useState } from "react";
import { FilePenLine, FilePlus2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import ReferralPopUp from "@/components/shared/read-only/patient-container/referral/ReferralPopUp";
import { getConsultation } from "@/lib/api/visit/doctors-consultation/getConsultation";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { Referral } from "@/lib/types/consultation";
import { POP } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Props {
  patient: PatientInfo;
  // Called after the referral was saved or deleted, to reload the list.
  onChanged?: () => void | Promise<unknown>;
}

// Add or edit the referral of a patient's completed visit, e.g. once results come back after they
// were discharged. The same form as at Consult; shown only when the latest visit is completed.
export default function ReferralAction({ patient, onChanged }: Props) {
  const visitId = patient.completed_visit_id;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referral, setReferral] = useState<Referral | null>(null);

  if (!visitId) return null;

  const hasReferral = Boolean(patient.completed_visit_has_referral);
  const label = `${hasReferral ? "Edit" : "Add"} referral for ${patient.english_name || "patient"}`;
  const Icon = hasReferral ? FilePenLine : FilePlus2;
  // The form only needs the visit; the rest of a queue card doesn't apply to a finished visit.
  const visit: QueuedPatient = { visit_id: visitId, patient_id: patient.id, queue_no: "", timestamp: "" };

  const start = async () => {
    setLoading(true);
    try {
      // Loads the saved referral, and its version so the save can't overwrite someone else's.
      setReferral((await getConsultation(visitId))?.referral ?? null);
      setOpen(true);
    } catch {
      toast.error("Can't reach the host laptop to load the referral. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className={cn(POP, "text-primary")}
        title={hasReferral ? "Edit referral" : "Add referral"}
        aria-label={label}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </button>
      {open && (
        <ReferralPopUp
          patient={visit}
          patientInfo={patient}
          retrievedReferral={referral}
          showPopUp={open}
          setShowPopUp={setOpen}
          onSaved={() => void onChanged?.()}
          onDeleted={() => void onChanged?.()}
        />
      )}
    </>
  );
}
