"use client"

import { useEffect, useId, useState } from "react";
import GlassButton from "../shared/GlassButton";
import { ChevronDown } from "lucide-react";
import ReferralButton from "../shared/read-only/patient-container/referral/ReferralButton";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { getPatient } from "@/lib/api/patients/getPatient";
import toast from "react-hot-toast";
import Loading from "../shared/Loading";
import { Consultation, Referral } from "@/lib/types/consultation";
import { getConsultation } from "@/lib/api/visit/doctors-consultation/getConsultation";
import { postConsultation } from "@/lib/api/visit/doctors-consultation/postConsultation";
import { PageCard } from "../shared/PageCard";

interface Props {
  patient: QueuedPatient;
}

export default function DoctorsNotesContainer({ patient }: Props) {
  const referralPanelId = useId();
  const notesId = useId();
  const prescriptionId = useId();
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
  const [notes, setNotes] = useState<string>("")
  const [prescription, setPrescription] = useState<string>("")
  const [referralNeeded, setReferralNeeded] = useState<boolean>(false)
  const [saving, setSaving] = useState(false);
  const [referral, setReferral] = useState<Referral | null>(null)


  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const data: Consultation = {
      notes: notes,
      prescription: prescription,
      requireReferral: referralNeeded,
      referral: referral      // is ignored by postConsultation
    }
    
    try {
      await postConsultation(data, patient.visit_id)
      toast.success("Save Success")
    } catch (error) {
      console.error("Consultation save failed:", error);
      toast.error("An error has occurred")
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!patient?.patient_id) {
      toast.error("An error has occured")
      console.log("Invalid patient/patient id")
      setPatientInfo(null)
      return;
    }

    let cancelled = false;

    const fetchPatient = async () => {
      try {
        const data = await getPatient(patient.patient_id!);
        if (!cancelled) setPatientInfo(data);
      } catch (err) {
        if (!cancelled) {
          toast.error("An error has occured")
          console.error("Failed to fetch patient:", err);
          setPatientInfo(null)
        }
      }
    };

    fetchPatient();

    return () => { cancelled = true; };
  }, [patient.patient_id]);

  useEffect(() => {
    let cancelled = false;

    const fetchConsultation = async () => {
      try {
        const data: Consultation | null = await getConsultation(patient.visit_id);
        if (cancelled) return;

        if (!data) {
          setNotes("");
          setPrescription("");
          setReferralNeeded(false);
          setReferral(null);
          return;
        }

        setNotes(data.notes);
        setPrescription(data.prescription);
        setReferralNeeded(data.requireReferral);
        setReferral(data.referral);
      } catch (error) {
        if (!cancelled) {
          toast.error("Failed to load consultation data");
          console.error("Error loading consultation:", error);
        }
      }
    };

    fetchConsultation();

    return () => { cancelled = true; };
  }, [patient.visit_id])

  return (
    <PageCard
      title="Consultation Notes"
      className="min-w-0 xl:col-span-8"
      headerClassName="text-base"
      contentClassName="space-y-4 text-sm leading-5"
    >
      <div className="space-y-2">
        <label htmlFor={notesId} className="font-semibold">Consultation notes</label>
        <textarea id={notesId} rows={6} value={notes} onChange={event => setNotes(event.target.value)}
          className="block w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="space-y-2">
        <label htmlFor={prescriptionId} className="font-semibold">Prescription</label>
        <textarea id={prescriptionId} rows={4} value={prescription} onChange={event => setPrescription(event.target.value)}
          className="block w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <GlassButton type="button" className="h-10" disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save consultation notes"}
        </GlassButton>
        <div className="ml-auto w-full overflow-hidden rounded-[1.25rem] bg-gradient-to-b from-background/90 to-muted/30 shadow-sm ring-1 ring-foreground/10 sm:w-72">
          <GlassButton
            type="button"
            className="h-10 w-full justify-between bg-none shadow-none ring-0 hover:shadow-none"
            aria-pressed={referralNeeded}
            aria-expanded={referralNeeded}
            aria-controls={referralPanelId}
            onClick={() => setReferralNeeded(value => !value)}
          >
            <span>Referral needed</span>
            <span className="ml-auto text-xs text-muted-foreground">{referralNeeded ? "Yes" : "No"}</span>
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${referralNeeded ? "rotate-180" : ""}`} />
          </GlassButton>
          {/* Keep the panel mounted for a smooth height transition; closed actions cannot receive focus. */}
          <div id={referralPanelId} aria-hidden={!referralNeeded} inert={!referralNeeded}
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${referralNeeded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col items-end gap-2 border-t border-border/50 p-3">
                {patientInfo === null ? <Loading /> : (
                  <ReferralButton
                    patient={patient}
                    patientInfo={patientInfo}
                    retrievedReferral={referral}
                    onSaved={setReferral}
                  />
                )}
                <p className="text-right text-xs text-muted-foreground">Referral choice is saved with consultation notes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageCard>
  )
}
