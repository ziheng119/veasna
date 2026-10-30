"use client";

import { CONSULTATION_CONDITIONS } from "@/constants/consultationConditions";
import SavedRecordFields from "@/components/shared/SavedRecordFields";
import { useSavedRecordAccess } from "@/hooks/useSavedRecordAccess";
import { useEffect, useId, useState } from "react";
import GlassButton from "../shared/GlassButton";
import ReferralButton from "../shared/read-only/patient-container/referral/ReferralButton";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { getPatient } from "@/lib/api/patients/getPatient";
import toast from "react-hot-toast";
import Loading from "../shared/Loading";
import { Consultation, Referral } from "@/lib/types/consultation";
import { getConsultation } from "@/lib/api/visit/doctors-consultation/getConsultation";
import { postConsultation } from "@/lib/api/visit/doctors-consultation/postConsultation";
import { PageCard } from "../shared/PageCard";
import PrescriptionPanel from "./PrescriptionPanel";

interface Props {
  patient: QueuedPatient;
}

export default function DoctorsNotesContainer({ patient }: Props) {
  const { editable, markSaved } = useSavedRecordAccess(patient.visit_id);
  const notesId = useId();
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [conditionCategories, setConditionCategories] = useState<string[] | null>(null);
  const [notes, setNotes] = useState<string>("");
  // Free-text prescription from before prescribing was linked to the pharmacy. It is kept as it was
  // and sent back unchanged when the notes are saved; new prescriptions go through PrescriptionPanel.
  const [prescription, setPrescription] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referral, setReferral] = useState<Referral | null>(null);

  const handleSave = async () => {
    if (!editable) return;
    if (saving || !loaded) return;
    setSaving(true);
    const data: Consultation = {
      notes: notes,
      conditionCategories,
      prescription: prescription,
      requireReferral: referral !== null,
      referral: referral, // is ignored by postConsultation
    };

    try {
      await postConsultation(data, patient.visit_id);
      markSaved();
      toast.success("Save Success");
    } catch (error) {
      console.error("Consultation save failed:", error);
      toast.error("An error has occurred");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!patient?.patient_id) {
      toast.error("An error has occured");
      console.log("Invalid patient/patient id");
      setPatientInfo(null);
      return;
    }

    let cancelled = false;

    const fetchPatient = async () => {
      try {
        const data = await getPatient(patient.patient_id!);
        if (!cancelled) setPatientInfo(data);
      } catch (err) {
        if (!cancelled) {
          toast.error("An error has occured");
          console.error("Failed to fetch patient:", err);
          setPatientInfo(null);
        }
      }
    };

    fetchPatient();

    return () => {
      cancelled = true;
    };
  }, [patient.patient_id]);

  useEffect(() => {
    let cancelled = false;

    const fetchConsultation = async () => {
      try {
        const data: Consultation | null = await getConsultation(
          patient.visit_id,
        );
        if (cancelled) return;

        setLoaded(true);
        setConditionCategories(data?.conditionCategories ?? null);
        markSaved(data !== null && data.hasSavedNotes !== false);
        if (!data) {
          setNotes("");
          setPrescription("");
          setReferral(null);
          return;
        }

        setNotes(data.notes);
        setPrescription(data.prescription);
        setReferral(data.referral);
      } catch (error) {
        if (!cancelled) {
          setLoadFailed(true);
          toast.error("Failed to load consultation data");
          console.error("Error loading consultation:", error);
        }
      }
    };

    fetchConsultation();

    return () => {
      cancelled = true;
    };
  }, [patient.visit_id, markSaved]);

  return (
    <PageCard
      title="Consultation Notes"
      className="min-w-0"
      headerClassName="text-base"
      contentClassName="space-y-4 text-sm leading-5"
    >
      {/* Full page width: notes and conditions on the left, prescribing on the right. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <SavedRecordFields locked={!editable}>
            <div className="space-y-2">
              <label htmlFor={notesId} className="font-semibold">
                Consultation notes
              </label>
              <textarea
                id={notesId}
                rows={8}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="block w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <fieldset className="space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 font-semibold">Conditions addressed</legend>
              <p className="text-xs text-muted-foreground">Select conditions addressed for this patient during this consultation, not family history or ruled-out conditions.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {CONSULTATION_CONDITIONS.map(condition => <label key={condition.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={conditionCategories?.includes(condition.id) ?? false}
                    onChange={event => setConditionCategories(previous => event.target.checked
                      ? [...(previous ?? []), condition.id] : (previous ?? []).filter(id => id !== condition.id))} />
                  {condition.label}
                </label>)}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={conditionCategories !== null && conditionCategories.length === 0}
                    onChange={event => setConditionCategories(event.target.checked ? [] : null)} />
                  None of the listed conditions
                </label>
              </div>
              <p className="text-xs text-muted-foreground">{conditionCategories === null ? "Not recorded yet. Existing notes are not automatically classified." : "These selections will be saved with the consultation notes."}</p>
            </fieldset>
          </SavedRecordFields>
        </div>
        {/* Prescriptions are separate records: they can be added after the notes are saved. */}
        <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
          <PrescriptionPanel visitId={patient.visit_id} legacyPrescription={prescription} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GlassButton
          type="button"
          className="h-10"
          disabled={saving || !loaded || !editable}
          onClick={handleSave}
        >
          {saving ? "Saving..." : "Save consultation notes"}
        </GlassButton>
        <div className="ml-auto">
          {loadFailed ? (
            <p role="alert" className="text-sm text-destructive">
              Unable to load consultation. Switch patients and try again.
            </p>
          ) : !loaded || patientInfo === null ? (
            <Loading />
          ) : (
            <ReferralButton
              patient={patient}
              patientInfo={patientInfo}
              retrievedReferral={referral}
              onSaved={setReferral}
              onDeleted={() => setReferral(null)}
            />
          )}
        </div>
      </div>
    </PageCard>
  );
}
