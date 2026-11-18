"use client";

import { useFormOptions } from "@/stores/useFormOptionsStore";
import SavedRecordFields from "@/components/shared/SavedRecordFields";
import { useSavedRecordAccess } from "@/hooks/useSavedRecordAccess";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import ReferralButton from "../shared/read-only/patient-container/referral/ReferralButton";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { getPatient } from "@/lib/api/patients/getPatient";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import Loading from "../shared/Loading";
import { Consultation, Referral } from "@/lib/types/consultation";
import { getConsultation } from "@/lib/api/visit/doctors-consultation/getConsultation";
import { postConsultation } from "@/lib/api/visit/doctors-consultation/postConsultation";
import StationForm from "../shared/StationForm";
import PrescriptionPanel from "./PrescriptionPanel";
import DentalSummary from "./DentalSummary";
import SendToPhysiotherapy from "./SendToPhysiotherapy";
import { SaveAndNextButton, StationDonePrompt, useSaveBeforeNext } from "../shared/StationFlow";
import { LiveRecordNotice, useLiveRecord } from "../shared/LiveRecord";
import { useRecordLoad } from "@/hooks/useRecordLoad";

interface Props {
  patient: QueuedPatient;
}

// Notes and conditions save themselves this long after the doctor stops typing or ticking, and
// again this long after a save that failed (e.g. the host laptop out of reach).
const AUTOSAVE_MS = 1500;
const RETRY_MS = 15000;

type NotesValues = { notes: string; conditionCategories: string[] | null };
const valuesOf = (data: Consultation | null): NotesValues => ({ notes: data?.notes ?? "", conditionCategories: data?.conditionCategories ?? null });
// What is still needed before the notes count as finished: notes, and the conditions ticked (or None).
function missing({ notes, conditionCategories }: NotesValues): string | null {
  const noNotes = notes.trim() === "";
  const noConditions = conditionCategories === null;
  if (noNotes && noConditions) return "Write notes and tick the conditions addressed (or None) to finish.";
  if (noNotes) return "Write consultation notes to finish.";
  if (noConditions) return "Tick the conditions addressed (or None) to finish.";
  return null;
}
const timeOf = (date: Date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function DoctorsNotesContainer({ patient }: Props) {
  const conditions = useFormOptions("consultation_conditions");
  const { editable, saved, markSaved, savedVersion } = useSavedRecordAccess(patient.visit_id);
  const notesId = useId();
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [conditionCategories, setConditionCategories] = useState<string[] | null>(null);
  const [notes, setNotes] = useState<string>("");
  // Free-text prescription from before prescribing was linked to the pharmacy. It is kept as it was
  // and sent back unchanged when the notes are saved; new prescriptions go through PrescriptionPanel.
  const [prescription, setPrescription] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referral, setReferral] = useState<Referral | null>(null);
  // For the visit summary in the footer; both panels save their own records as soon as they change.
  const [prescriptionCount, setPrescriptionCount] = useState(0);
  const [physioReferred, setPhysioReferred] = useState(false);

  const values: NotesValues = { notes, conditionCategories };
  const current = JSON.stringify(values);
  // The notes and conditions as the host has them (loaded, saved here, or a save from elsewhere).
  const [savedValues, setSavedValues] = useState<string | null>(null);
  // The autosave line beside Save & next. `attempt` counts failed saves, so one is retried.
  const [autosave, setAutosave] = useState<{ state: "idle" | "saved" | "failed"; at?: Date; attempt: number }>({ state: "idle", attempt: 0 });

  const send = (snapshot: string) => postConsultation({
    ...(JSON.parse(snapshot) as NotesValues),
    prescription,
    requireReferral: referral !== null,
    referral, // is ignored by postConsultation
  }, patient.visit_id);

  // Saves what is typed now. Autosaves are quiet: the line beside Save & next says how it went.
  // Resolves to whether the notes are saved.
  const handleSave = async (quiet = false): Promise<boolean> => {
    if (!editable || !loaded) return false;
    if (saving) return false;
    if (saved && current === savedValues) return true;
    const snapshot = current;
    setSaving(true);
    try {
      await send(snapshot);
      setSavedValues(snapshot);
      markSaved();
      setAutosave((previous) => ({ state: "saved", at: new Date(), attempt: previous.attempt }));
      return true;
    } catch (error) {
      console.error("Consultation save failed:", error);
      setAutosave((previous) => ({ state: "failed", attempt: previous.attempt + 1 }));
      if (!quiet) toast.error(`Couldn't save the consultation notes: ${error instanceof Error ? error.message : "the host laptop didn't answer"}. They're kept on this device.`);
      return false;
    } finally {
      setSaving(false);
    }
  };
  const latestSave = useRef(handleSave);
  latestSave.current = handleSave;

  // Next on the queue card saves the notes and conditions first. Prescriptions, the referral and
  // the physiotherapy referral are saved as soon as they are made.
  useSaveBeforeNext(patient.visit_id, savedVersion, values, () => latestSave.current());

  useEffect(() => {
    if (!patient?.patient_id) {
      toast.error("This queue entry has no patient record. Open the patient again from the queue.");
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
          toast.error("Couldn't load the patient's details from the host laptop.");
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

  const load = useCallback(() => getConsultation(patient.visit_id), [patient.visit_id]);
  // The notes and conditions, which this form saves.
  const show = useCallback((data: Consultation | null) => {
    const shown = valuesOf(data);
    setLoaded(true);
    setConditionCategories(shown.conditionCategories);
    markSaved(data !== null && data.hasSavedNotes !== false);
    setNotes(shown.notes);
    setSavedValues(JSON.stringify(shown));
  }, [markSaved]);
  // Saved on their own: the referral, and the free-text prescription from older visits.
  const showShared = useCallback((data: Consultation | null) => {
    setPrescription(data?.prescription ?? "");
    setReferral(data?.referral ?? null);
  }, []);

  const showAll = useCallback((data: Consultation | null) => {
    show(data);
    showShared(data);
  }, [show, showShared]);
  const loadFailed = useRecordLoad(load, showAll, "Couldn't load the consultation");

  // Saves made for this visit on another device show here too, including a referral written there.
  const live = useLiveRecord({
    visitId: patient.visit_id, savedVersion, values, load, apply: show, applyShared: showShared, valuesOf,
    draft: { form: "consultation", restore: (draft: NotesValues) => {
      setNotes(draft.notes);
      setConditionCategories(draft.conditionCategories);
    } },
  });

  // Autosave: a pause in typing or ticking saves the notes and conditions. Not while another device's
  // save is waiting for Show saved version / Keep mine, or an earlier draft for Put mine back /
  // Discard: the doctor chooses first. A failed save is tried again after a while.
  const unsaved = loaded && savedValues !== null && current !== savedValues;
  const paused = live.notice === "conflict" || live.notice === "draft";
  useEffect(() => {
    if (!editable || saving || !unsaved || paused) return;
    const timer = setTimeout(() => void latestSave.current(true), autosave.state === "failed" ? RETRY_MS : AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [current, editable, saving, unsaved, paused, autosave.state, autosave.attempt]);

  // Opening another patient (or page) before the pause is up still saves what was typed.
  const pendingOnLeave = useRef<(() => void) | null>(null);
  pendingOnLeave.current = editable && unsaved && !paused ? () => void send(current).catch((error) => {
    console.error("Consultation save on leaving failed:", error);
    toast.error(`Couldn't save the consultation notes for queue number ${patient.queue_no}. Open the patient again to save them.`);
  }) : null;
  useEffect(() => () => pendingOnLeave.current?.(), []);

  const needed = missing(values);
  // Finished at Consult: notes and conditions saved, with nothing typed since. Only then is Save &
  // next green: while a change is waiting to save, or saving, it stays blue.
  const finished = saved && !unsaved && needed === null;
  const summary = [
    prescriptionCount > 0 && `${prescriptionCount} prescription${prescriptionCount === 1 ? "" : "s"}`,
    physioReferred && "Physiotherapy",
    referral !== null && "Hospital referral",
  ].filter(Boolean).join(" · ");
  const status = !editable ? null
    : saving ? "Saving…"
    : autosave.state === "failed" && unsaved ? "Couldn't reach the host. Kept on this device; trying again."
    : unsaved ? "Not saved yet"
    : saved && autosave.at ? `Saved ${timeOf(autosave.at)}`
    : saved ? "Saved"
    : null;

  // The hospital referral, saved on its own, on the left; on the right what this visit has so far
  // and the one way to finish: Save & next. The referral isn't locked with the fields: it can still
  // be written once the notes are saved.
  const buttons = (
    <>
      <div>
        {loadFailed ? (
          <p role="alert" className="text-sm text-destructive">
            Can&apos;t reach the host laptop to load this consultation. Trying again…
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
      <div className="ml-auto flex min-w-0 items-center gap-3">
        {loaded && (
          <div className="min-w-0 text-right text-xs leading-4">
            {summary && <p className="font-medium text-foreground">This visit: {summary}</p>}
            {/* Polite: the save line changes often, and a screen reader shouldn't interrupt typing. */}
            <p aria-live="polite" className={cn(autosave.state === "failed" && unsaved ? "text-destructive" : "text-muted-foreground")}>
              {[status, editable && needed].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}
        {/* Prescribe and tick Physiotherapy first: the patient goes to whatever is next on their route. */}
        <SaveAndNextButton patient={patient} onSave={() => handleSave()} primary
          ready={finished} locked={saved && !editable}
          disabled={saving || !loaded || (!editable && !saved)}
          hint={needed ?? undefined} />
      </div>
    </>
  );

  // In the open patient's column on the Consult page (StationSurface), under what was recorded before.
  return (
    <StationForm station="consultation" title="Consultation Notes" footer={buttons} footerClassName="justify-between"
      className="@container text-sm leading-5">
      {/* Never "done" here: Save & next turning green is Consult's one finish, and the prompt above
          the form would offer the same mid-prescribing. It still shows a departure that failed. */}
      <StationDonePrompt patient={patient} done={false} />
      <LiveRecordNotice live={live} />
      {/* Notes and conditions, then prescribing; side by side once the column is wide enough. */}
      <div className="grid gap-6 @3xl:grid-cols-2">
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
                {conditions.map(condition => <label key={condition.id} className="flex items-center gap-2 text-sm">
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
              <p className="text-xs text-muted-foreground">{conditionCategories === null ? "Not recorded yet. Existing notes are not automatically classified." : "Saved with the consultation notes as you tick."}</p>
            </fieldset>
          </SavedRecordFields>
        </div>
        {/* Prescriptions are separate records: they can be added after the notes are saved.
            Prescribing adds Pharmacy to the patient's route. */}
        <div className="min-w-0 space-y-4 @3xl:border-l @3xl:border-border @3xl:pl-6">
          <DentalSummary visitId={patient.visit_id} />
          <SendToPhysiotherapy patient={patient} onReferredChange={setPhysioReferred} />
          <PrescriptionPanel visitId={patient.visit_id} legacyPrescription={prescription} onCountChange={setPrescriptionCount} />
        </div>
      </div>
    </StationForm>
  );
}
