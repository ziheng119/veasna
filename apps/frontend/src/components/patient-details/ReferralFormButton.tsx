"use client";

import { useState } from "react";
import { FilePenLine, FilePlus2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import GlassButton from "@/components/shared/GlassButton";
import ReferralPopUp from "@/components/shared/read-only/patient-container/referral/ReferralPopUp";
import { getConsultation } from "@/lib/api/visit/doctors-consultation/getConsultation";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { Referral } from "@/lib/types/consultation";
import { ENTER_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Props {
  visitId: number;
  patient: PatientInfo;
  hasReferral: boolean;
  // Called after the referral was saved or deleted, to reload the visit.
  onChanged: () => void | Promise<unknown>;
}

// Opens the same referral form as at Consult (with signature and printing) for one visit, so a
// referral can be added, re-signed or printed after the patient has left the queue.
export default function ReferralFormButton({ visitId, patient, hasReferral, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referral, setReferral] = useState<Referral | null>(null);
  // The form only needs the visit; the rest of a queue card doesn't apply here.
  const visit: QueuedPatient = { visit_id: visitId, patient_id: patient.id, queue_no: "", timestamp: "" };
  const Icon = hasReferral ? FilePenLine : FilePlus2;

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
      <GlassButton
        size="sm"
        onClick={start}
        disabled={loading}
        className={cn("h-8 gap-1.5 px-3 hover:-translate-y-px", ENTER_FAST)}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
        {hasReferral ? "Sign / print" : "Add referral"}
      </GlassButton>
      {open && (
        <ReferralPopUp
          patient={visit}
          patientInfo={patient}
          retrievedReferral={referral}
          showPopUp={open}
          setShowPopUp={setOpen}
          onSaved={() => void onChanged()}
          onDeleted={() => void onChanged()}
        />
      )}
    </>
  );
}
