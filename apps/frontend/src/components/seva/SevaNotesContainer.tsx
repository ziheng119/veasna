"use client";

import SavedRecordFields from "@/components/shared/SavedRecordFields";
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { useSavedRecordAccess } from "@/hooks/useSavedRecordAccess";
import { useCallback, useState } from "react";
import SaveButton from "../shared/SaveButton";
import { SaveAndNextButton, StationDonePrompt, useSaveBeforeNext } from "../shared/StationFlow";
import { LiveRecordNotice, useLiveRecord } from "../shared/LiveRecord";
import VerticalLabelInputPair from "../shared/VerticalLabelInputPair";
import toast from "react-hot-toast";
import { Seva } from "@/lib/types/seva";
import { QueuedPatient } from "@/lib/types/patient";
import { getSeva } from "@/lib/api/visit/seva/getSeva";
import { postSeva } from "@/lib/api/visit/seva/postSeva";
import formatDate from "@/helper/format_date";
import { PageCard } from "../shared/PageCard";
import EyeReadingsGrid, { EMPTY_EYE_READINGS, EYE_READING_FIELDS, EyeReadingField, EyeReadings, REQUIRED_EYE_READING_FIELDS } from "../shared/EyeReadingsGrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEVA_REFERRALS, SevaReferral } from "@/constants/sevaReferral";
import { normalizeSnellenFields, SNELLEN_ERROR } from "@/lib/snellen";
import { useRecordLoad } from "@/hooks/useRecordLoad";

// Radix Select items cannot have an empty value, so "no referral" needs a stand-in.
const NO_REFERRAL = "none";

// Each eye reading and its field in the partner NGO record (left_with_pinhole -> leftWithPinholeNew).
type SevaReadingKey = Exclude<keyof Seva, "diagnosis" | "dateOfReferral" | "referral" | "notes">;
const sevaKey = (field: EyeReadingField) =>
  `${field.replace(/_(\w)/g, (_, letter: string) => letter.toUpperCase())}New` as SevaReadingKey;

interface Props {
  patient: QueuedPatient;
}

// The form's values for a saved record (empty when there is none), in the order the form saves them.
function sevaFormValues(data: Seva | null) {
  return {
    readings: Object.fromEntries(EYE_READING_FIELDS.map((field) => [field, data?.[sevaKey(field)] ?? ""])) as EyeReadings,
    diagnosis: data?.diagnosis ?? "",
    dateOfReferral: data?.dateOfReferral ? formatDate(data.dateOfReferral) : "",
    referral: (data?.referral ?? "") as SevaReferral | "",
    additionalNotes: data?.notes ?? "",
  };
}

export default function SevaNotesContainer({ patient }: Props) {
  const { editable, saved, markSaved, savedVersion } = useSavedRecordAccess(patient.visit_id);
  const [readings, setReadings] = useState<EyeReadings>(EMPTY_EYE_READINGS);
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [dateOfReferral, setDateOfReferral] = useState<string>("");
  const [referral, setReferral] = useState<SevaReferral | "">("");
  const [additionalNotes, setAdditionalNotes] = useState<string>("");

  const load = useCallback(() => getSeva(patient.visit_id), [patient.visit_id]);
  const show = useCallback((data: Seva | null) => {
    markSaved(data !== null);
    const values = sevaFormValues(data);
    setReadings(values.readings);
    setDiagnosis(values.diagnosis);
    setDateOfReferral(values.dateOfReferral);
    setReferral(values.referral);
    setAdditionalNotes(values.additionalNotes);
  }, [markSaved]);

  useRecordLoad(load, show, `Couldn't load the ${PARTNER_NGO_NAME} notes`);

  // Resolves to whether the notes were saved.
  const handleSave = async (): Promise<boolean> => {
    if (!editable) return false;
    const normalized = normalizeSnellenFields(readings);
    if (!normalized) {
      toast.error(SNELLEN_ERROR);
      return false;
    }

    setReadings(normalized);
    const fractions = Object.fromEntries(EYE_READING_FIELDS.map((field) => [sevaKey(field), normalized[field]])) as Record<SevaReadingKey, string>;
    const data: Seva = {
      ...fractions,
      diagnosis: diagnosis,
      dateOfReferral: dateOfReferral,
      referral: referral,
      notes: additionalNotes,
    };

    try {
      await postSeva(data, patient.visit_id);
      markSaved();
      toast.success("Save Success");
      return true;
    } catch (error) {
      toast.error("An error has occurred");
      return false;
    }
  };
  // Next on the queue card saves this form first.
  useSaveBeforeNext(patient.visit_id, savedVersion, { readings, diagnosis, dateOfReferral, referral, additionalNotes }, handleSave);
  // Saves made for this visit on another device show here too.
  const live = useLiveRecord({
    visitId: patient.visit_id, savedVersion, values: { readings, diagnosis, dateOfReferral, referral, additionalNotes },
    load, apply: show, valuesOf: sevaFormValues,
    draft: { form: "seva", restore: (draft: ReturnType<typeof sevaFormValues>) => {
      setReadings(draft.readings);
      setDiagnosis(draft.diagnosis);
      setDateOfReferral(draft.dateOfReferral);
      setReferral(draft.referral);
      setAdditionalNotes(draft.additionalNotes);
    } },
  });

  // Saved readings are shown open so they are not missed.
  const eyeReadingsRecorded = EYE_READING_FIELDS.some((field) => Boolean(readings[field]));
  // With glasses is optional, so only the pinhole readings are needed to finish.
  const eyeReadingsComplete = REQUIRED_EYE_READING_FIELDS.every((field) => Boolean(readings[field]));

  return (
    <PageCard
      title={`${PARTNER_NGO_NAME} Notes`}
      className="xl:col-span-4"
      contentClassName="space-y-4"
    >
      <StationDonePrompt patient={patient} done={saved} />
      <LiveRecordNotice live={live} />
      <SavedRecordFields locked={!editable}>
        {/* Kept deliberately simple: the fields may change with the partner NGO's requests.
            Free-text notes come first; eye readings are optional. */}
        <div className="flex w-full">
          <VerticalLabelInputPair
            label="Notes"
            onChangeFunction={setAdditionalNotes}
            value={additionalNotes}
          />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <h2 className="text-[15px] font-semibold">Referral needed</h2>
          <Select
            value={referral || NO_REFERRAL}
            onValueChange={(value) =>
              setReferral(value === NO_REFERRAL ? "" : (value as SevaReferral))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              avoidCollisions={false}
              className="bg-popover border-border"
            >
              <SelectItem value={NO_REFERRAL}>No referral</SelectItem>
              {SEVA_REFERRALS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <h2 className="text-[15px] font-semibold">Date of Referral</h2>
          <input
            type="date"
            placeholder="DD/MM/YYYY"
            className="bg-background border border-input rounded-sm p-2 w-40 text-foreground"
            onChange={(e) => setDateOfReferral(e.target.value)}
            value={dateOfReferral}
          />
        </div>

        <VerticalLabelInputPair
          label="Diagnosis"
          onChangeFunction={setDiagnosis}
          value={diagnosis}
        />

        <details className="group rounded-md border border-border px-3 py-2" open={eyeReadingsRecorded}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-muted-foreground">
            Eye readings (optional)
          </summary>
          <div className="mt-3">
            <EyeReadingsGrid values={readings} onChange={(field, value) => setReadings((previous) => ({ ...previous, [field]: value }))} />
          </div>
        </details>

        <div className="flex items-center justify-end gap-2">
          <SaveButton onClick={handleSave} disabled={!editable} />
          <SaveAndNextButton patient={patient} onSave={handleSave} ready={saved || (eyeReadingsComplete && diagnosis.trim() !== "")}
            locked={saved && !editable} disabled={!editable && !saved} hint="Take the eye readings without and with pinhole, and write a diagnosis, to finish" />
        </div>
      </SavedRecordFields>
    </PageCard>
  );
}
