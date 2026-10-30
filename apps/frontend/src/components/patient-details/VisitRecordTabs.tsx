"use client";

import { ReactNode, useMemo, useState } from "react";
import { ClipboardList, ShieldAlert } from "lucide-react";
import { STATION_ICONS } from "@/components/shared/StationBadge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import DottedImage from "@/components/physiotherapy/DottedImage";
import SegmentedTabs, { SegmentedTab } from "@/components/shared/SegmentedTabs";
import EditableRecordSection, { CheckboxTile, FieldOption, FieldSpec } from "./EditableRecordSection";
import { ENTER_FAST } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { CONSULTATION_CONDITIONS } from "@/constants/consultationConditions";
import { REFERRAL_DESTINATIONS, parseReferralDestinations } from "@/constants/referral";
import { SEVA_REFERRALS, SevaReferral } from "@/constants/sevaReferral";
import { TB_RED_FLAGS, TB_STATUS_LABELS, TbStatus, isTbFlagged } from "@/constants/tb";
import { PARTNER_NGO_NAME } from "@/constants/partnerNgo";
import { QUEUE_NO_ERROR, isValidQueueNo } from "@/lib/queueNumber";
import { useLocationStore } from "@/stores/useLocationStore";
import { updateVisitDetails, updateVisitTb, updateVisitVitals } from "@/lib/api/visit/adminEdits";
import { saveMedicalHistory, savePresentingComplaint, saveVisualAcuity } from "@/lib/api/triage/triageService";
import { postSeva } from "@/lib/api/visit/seva/postSeva";
import { postPhysiotherapy } from "@/lib/api/visit/physiotherapy/postPhysiotherapy";
import { postConsultation } from "@/lib/api/visit/doctors-consultation/postConsultation";
import { postReferral } from "@/lib/api/visit/postReferral";
import { PainPoint } from "@/lib/types/physiotherapy";
import { VisitDetails } from "@/lib/types/visit";

// Edit-form shapes. Numbers are kept as the text typed so partially entered values survive.
type VisitInfoDraft = { queue_no: string; visit_date: string; location_id: string };
type VitalsDraft = {
  height: string; weight: string; bmi: string; below_3rd_percentile: boolean;
  bp_systolic: string; bp_diastolic: string; temperature: string; notes: string;
};
type HefDraft = { know_of_hef: boolean; has_hef: boolean; notes: string };
// status "" = not reviewed yet (suspected).
type TbDraft = { status: TbStatus; red_flags: string[]; flag_notes: string; doctor_notes: string };
type AcuityDraft = {
  left_with_pinhole: string; left_without_pinhole: string;
  right_with_pinhole: string; right_without_pinhole: string; notes: string;
};
type ComplaintDraft = { history: string; red_flags: string; systems_review: string; drug_allergies: string };
type HistoryDraft = { past: string; drug_and_treatment: string; family: string; social: string; systems_review: string };
type SevaDraft = {
  left_with_pinhole_new: string; left_without_pinhole_new: string;
  right_with_pinhole_new: string; right_without_pinhole_new: string;
  diagnosis: string; referral: string; date_of_referral: string; notes: string;
};
type PhysioDraft = { notes: string; painpoints: PainPoint[] };
type ConsultDraft = { notes: string; prescription: string; condition_categories: string[] | null };
type ReferralDraft = { referral_date: string; destinations: string[]; illness: string; duration: string; reason: string };

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));

const TB_STATUS_OPTIONS: FieldOption[] = (["suspected", "tb_likely", "cleared"] as const).map((status) => ({
  value: status,
  label: TB_STATUS_LABELS[status],
}));
const TB_FLAG_OPTIONS: FieldOption[] = TB_RED_FLAGS.map((flag) => ({ value: flag.id, label: flag.label }));
const SEVA_REFERRAL_OPTIONS: FieldOption[] = SEVA_REFERRALS.map((r) => ({ value: r.id, label: r.label }));
const DESTINATION_OPTIONS: FieldOption[] = REFERRAL_DESTINATIONS.map((d) => ({ value: d, label: d }));

const VITALS_FIELDS: FieldSpec<VitalsDraft>[] = [
  { key: "height", label: "Height (cm)", kind: "number" },
  { key: "weight", label: "Weight (kg)", kind: "number" },
  { key: "bmi", label: "BMI (calculated)", kind: "number" },
  { key: "below_3rd_percentile", label: "Below 3rd Percentile", kind: "boolean" },
  { key: "bp_systolic", label: "BP Systolic (mmHg)", kind: "number", step: "1" },
  { key: "bp_diastolic", label: "BP Diastolic (mmHg)", kind: "number", step: "1" },
  { key: "temperature", label: "Temperature (°C)", kind: "number" },
  { key: "notes", label: "Notes", kind: "textarea", wide: true },
];
const HEF_FIELDS: FieldSpec<HefDraft>[] = [
  { key: "know_of_hef", label: "Knows of HEF", kind: "boolean" },
  { key: "has_hef", label: "Has HEF", kind: "boolean" },
  { key: "notes", label: "Notes", kind: "textarea", wide: true },
];
const ACUITY_FIELDS: FieldSpec<AcuityDraft>[] = [
  { key: "left_with_pinhole", label: "Left (with pinhole)", kind: "snellen" },
  { key: "left_without_pinhole", label: "Left (without pinhole)", kind: "snellen" },
  { key: "right_with_pinhole", label: "Right (with pinhole)", kind: "snellen" },
  { key: "right_without_pinhole", label: "Right (without pinhole)", kind: "snellen" },
  { key: "notes", label: "Notes", kind: "textarea", wide: true },
];
const COMPLAINT_FIELDS: FieldSpec<ComplaintDraft>[] = [
  { key: "history", label: "History", kind: "textarea", wide: true },
  { key: "red_flags", label: "Red Flags", kind: "textarea", wide: true },
  { key: "systems_review", label: "Systems Review", kind: "textarea", wide: true },
  { key: "drug_allergies", label: "Drug Allergies", kind: "textarea", wide: true },
];
const HISTORY_FIELDS: FieldSpec<HistoryDraft>[] = [
  { key: "past", label: "Past Medical History", kind: "textarea", wide: true },
  { key: "drug_and_treatment", label: "Drug and Treatment History", kind: "textarea", wide: true },
  { key: "family", label: "Family History", kind: "textarea", wide: true },
  { key: "social", label: "Social History", kind: "textarea", wide: true },
  { key: "systems_review", label: "Systems Review", kind: "textarea", wide: true },
];
const SEVA_FIELDS: FieldSpec<SevaDraft>[] = [
  { key: "left_with_pinhole_new", label: "Left (with pinhole)", kind: "snellen" },
  { key: "left_without_pinhole_new", label: "Left (without pinhole)", kind: "snellen" },
  { key: "right_with_pinhole_new", label: "Right (with pinhole)", kind: "snellen" },
  { key: "right_without_pinhole_new", label: "Right (without pinhole)", kind: "snellen" },
  { key: "diagnosis", label: "Diagnosis", kind: "textarea", wide: true },
  { key: "referral", label: "Referral Needed", kind: "select", options: SEVA_REFERRAL_OPTIONS, allowBlank: "No referral" },
  { key: "date_of_referral", label: "Date of Referral", kind: "date" },
  { key: "notes", label: "Notes", kind: "textarea", wide: true },
];
const PHYSIO_FIELDS: FieldSpec<PhysioDraft>[] = [
  { key: "notes", label: "Notes", kind: "textarea", wide: true },
  {
    key: "painpoints",
    label: "Body Chart Indication",
    kind: "custom",
    wide: true,
    render: (value, onChange, editing) => {
      const points = value as PainPoint[];
      return (
        <>
          <DottedImage
            imageUrl="/bodychart.jpg"
            readOnly={!editing}
            positions={points}
            onClickFunction={editing ? (next) => onChange(next) : undefined}
          />
          {editing ? (
            <p className="mt-2 text-sm text-muted-foreground">Click the chart to add a point; click a point to remove it.</p>
          ) : (
            !points.length && <p className="mt-2 text-sm text-muted-foreground">No pain points marked.</p>
          )}
        </>
      );
    },
  },
];
const CONSULT_FIELDS: FieldSpec<ConsultDraft>[] = [
  { key: "notes", label: "Notes", kind: "textarea", wide: true },
  { key: "prescription", label: "Prescription", kind: "textarea", wide: true },
  {
    key: "condition_categories",
    label: "Conditions Addressed",
    kind: "custom",
    wide: true,
    render: (value, onChange, editing) => {
      const selected = value as string[] | null;
      if (!editing) {
        if (selected === null) return <p>Not recorded</p>;
        if (!selected.length) return <p>None of the listed conditions</p>;
        return <p>{selected.map((id) => CONSULTATION_CONDITIONS.find((c) => c.id === id)?.label ?? id).join(", ")}</p>;
      }
      // Same tri-state as the consultation form: null = not recorded, [] = none of the listed.
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {CONSULTATION_CONDITIONS.map((condition) => (
            <CheckboxTile
              key={condition.id}
              label={condition.label}
              checked={selected?.includes(condition.id) ?? false}
              onChange={(checked) =>
                onChange(checked
                  ? [...(selected ?? []), condition.id]
                  : (selected ?? []).filter((id) => id !== condition.id))
              }
            />
          ))}
          <CheckboxTile
            label="None of the listed conditions"
            checked={selected !== null && selected.length === 0}
            onChange={(checked) => onChange(checked ? [] : null)}
          />
        </div>
      );
    },
  },
];
const REFERRAL_FIELDS: FieldSpec<ReferralDraft>[] = [
  { key: "referral_date", label: "Referral Date", kind: "date" },
  { key: "destinations", label: "Referral Destinations", kind: "checkboxes", options: DESTINATION_OPTIONS, wide: true },
  { key: "illness", label: "Condition / Illness", kind: "text" },
  { key: "duration", label: "Duration", kind: "text" },
  { key: "reason", label: "Reason for Referral", kind: "textarea", wide: true },
];
const TB_NOTE_FIELDS: FieldSpec<TbDraft>[] = [
  { key: "red_flags", label: "Red Flags", kind: "checkboxes", options: TB_FLAG_OPTIONS, wide: true },
  { key: "flag_notes", label: "Registration Notes", kind: "textarea", wide: true },
  { key: "doctor_notes", label: "Doctor's TB Notes", kind: "textarea", wide: true },
];
// Suspected TB is a flag on the visit, so its status can be corrected at any time.
const TB_FIELDS: FieldSpec<TbDraft>[] = [
  { key: "status", label: "TB Flag", kind: "select", options: TB_STATUS_OPTIONS, wide: true },
  ...TB_NOTE_FIELDS,
];

// BMI follows height and weight, rounded like the registration form.
function deriveBmi(draft: VitalsDraft): VitalsDraft {
  const heightM = Number(draft.height) / 100;
  const weightKg = Number(draft.weight);
  if (!(heightM > 0 && weightKg > 0)) return draft;
  return { ...draft, bmi: String(Math.round((weightKg / (heightM * heightM)) * 10) / 10) };
}

function validateVitals(draft: VitalsDraft): string | null {
  const numbers: (keyof VitalsDraft)[] = ["height", "weight", "bmi", "bp_systolic", "bp_diastolic", "temperature"];
  const invalid = numbers.find((key) => !(Number(draft[key]) > 0));
  if (invalid) return `${VITALS_FIELDS.find((f) => f.key === invalid)?.label} must be a positive number.`;
  if (!Number.isInteger(Number(draft.bp_systolic)) || !Number.isInteger(Number(draft.bp_diastolic))) {
    return "Blood pressure must be whole numbers.";
  }
  return null;
}

// Panels stay mounted so an unsaved edit survives switching tabs. Showing a hidden panel
// replays its entrance animation, so every switch feels the same.
function StationPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <TabsContent forceMount value={value} className={cn("space-y-4 data-[state=inactive]:hidden", ENTER_FAST)}>
      {children}
    </TabsContent>
  );
}

interface Props {
  visit: VisitDetails;
  canEdit: boolean;
  // Called after any section is saved, so the page can reload the visit and visit list.
  onSaved: () => Promise<void>;
}

/** Every record of one visit, grouped by station. Admins can correct or add each section. */
export default function VisitRecordTabs({ visit, canEdit, onSaved }: Props) {
  const locations = useLocationStore((state) => state.locations);
  // A visit flagged for suspected TB opens on its TB record.
  const [activeTab, setActiveTab] = useState(isTbFlagged(visit.tb?.status) ? "tb" : "registration");
  const visitId = visit.visit_id;

  // Drafts are memoised per visit: sections reset their form whenever the record object changes.
  const drafts = useMemo(() => {
    const { vitals, hef, visual_acuity: va, presenting_complaint: pc, history, seva, physiotherapy, consultation, tb } = visit;
    const referral = visit.referrals[0] ?? null;
    return {
      info: { queue_no: visit.queue_no, visit_date: visit.visit_date, location_id: text(visit.location_id) } as VisitInfoDraft,
      vitals: vitals && ({
        height: text(vitals.height), weight: text(vitals.weight), bmi: text(vitals.bmi),
        below_3rd_percentile: vitals.below_3rd_percentile, bp_systolic: text(vitals.bp_systolic),
        bp_diastolic: text(vitals.bp_diastolic), temperature: text(vitals.temperature), notes: text(vitals.notes),
      } as VitalsDraft),
      hef: hef && ({ know_of_hef: hef.know_of_hef, has_hef: hef.has_hef, notes: text(hef.notes) } as HefDraft),
      tb: tb && ({ status: tb.status, red_flags: tb.red_flags, flag_notes: text(tb.flag_notes), doctor_notes: text(tb.doctor_notes) } as TbDraft),
      acuity: va && ({
        left_with_pinhole: text(va.left_with_pinhole), left_without_pinhole: text(va.left_without_pinhole),
        right_with_pinhole: text(va.right_with_pinhole), right_without_pinhole: text(va.right_without_pinhole),
        notes: text(va.notes),
      } as AcuityDraft),
      complaint: pc && ({ ...pc } as ComplaintDraft),
      history: history && ({ ...history } as HistoryDraft),
      seva: seva && ({
        left_with_pinhole_new: text(seva.left_with_pinhole_new), left_without_pinhole_new: text(seva.left_without_pinhole_new),
        right_with_pinhole_new: text(seva.right_with_pinhole_new), right_without_pinhole_new: text(seva.right_without_pinhole_new),
        diagnosis: text(seva.diagnosis), referral: text(seva.referral), date_of_referral: text(seva.date_of_referral),
        notes: text(seva.notes),
      } as SevaDraft),
      physio: physiotherapy && ({
        notes: text(physiotherapy.notes),
        painpoints: (physiotherapy.painpoints ?? []).map((p) => ({ xCoord: p.x_coord, yCoord: p.y_coord })),
      } as PhysioDraft),
      consult: consultation && ({
        notes: text(consultation.notes), prescription: text(consultation.prescription),
        condition_categories: consultation.condition_categories,
      } as ConsultDraft),
      referral: referral && ({
        referral_date: text(referral.referral_date), destinations: parseReferralDestinations(referral.referral_type),
        illness: text(referral.illness), duration: text(referral.duration), reason: text(referral.reason),
      } as ReferralDraft),
    };
  }, [visit]);

  const locationOptions: FieldOption[] = useMemo(() => {
    const options = locations.map((l) => ({ value: String(l.id), label: l.name }));
    // Keep an inactive or not-yet-loaded location selectable so saving does not change it.
    if (visit.location_id && !options.some((o) => o.value === String(visit.location_id))) {
      options.unshift({ value: String(visit.location_id), label: visit.location_name ?? `Location ${visit.location_id}` });
    }
    return options;
  }, [locations, visit.location_id, visit.location_name]);

  const visitInfoFields: FieldSpec<VisitInfoDraft>[] = [
    { key: "queue_no", label: "Queue Number", kind: "text" },
    { key: "visit_date", label: "Visit Date", kind: "date" },
    { key: "location_id", label: "Location", kind: "select", options: locationOptions },
  ];

  // Wraps a station save so the page reloads afterwards.
  const saved = <D,>(save: (draft: D) => Promise<unknown>) => async (draft: D) => {
    await save(draft);
    await onSaved();
  };

  const hasRegistration = Boolean(visit.vitals || visit.hef);
  const hasTriage = Boolean(visit.visual_acuity || visit.presenting_complaint || visit.history);
  const hasConsultation = Boolean(visit.consultation || visit.referrals.length);
  // Users only open tabs with data; admins can open every tab to add a missing record.
  const tab = (value: string, label: string, icon: SegmentedTab["icon"], hasData: boolean): SegmentedTab =>
    ({ value, label, icon, marked: hasData, disabled: !canEdit && !hasData });
  const tabs: SegmentedTab[] = [
    ...(visit.tb ? [tab("tb", "TB Flag", ShieldAlert, true)] : []),
    tab("registration", "Registration", ClipboardList, hasRegistration),
    tab("triage", "Triage", STATION_ICONS.triage, hasTriage),
    tab("seva", PARTNER_NGO_NAME, STATION_ICONS.seva, Boolean(visit.seva)),
    tab("physio", "Physiotherapy", STATION_ICONS.physiotherapy, Boolean(visit.physiotherapy)),
    tab("consult", "Consultation", STATION_ICONS.consultation, hasConsultation),
  ];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-4">
      <SegmentedTabs tabs={tabs} value={activeTab} label="Visit stations" markedLabel="has records" />

      {visit.tb && drafts.tb && (
        <StationPanel value="tb">
          <EditableRecordSection
            title="Suspected TB"
            record={drafts.tb}
            fields={TB_FIELDS}
            canEdit={canEdit}
            readOnlyItems={[
              { label: "Last reviewed", value: visit.tb.reviewed_at ? new Date(visit.tb.reviewed_at).toLocaleString() : "Not yet" },
            ]}
            editHint="Set the TB flag to Removed if TB is ruled out; the patient's red queue marker goes away."
            onSave={saved((d: TbDraft) => updateVisitTb(visitId, {
              red_flags: d.red_flags,
              flag_notes: d.flag_notes,
              doctor_notes: d.doctor_notes,
              status: d.status,
            }))}
          />
        </StationPanel>
      )}

      <StationPanel value="registration">
        <EditableRecordSection
          title="Visit Details"
          record={drafts.info}
          fields={visitInfoFields}
          canEdit={canEdit}
          editHint="Queue numbers must be unique for the location and date."
          validate={(d) => {
            if (!isValidQueueNo(d.queue_no)) return QUEUE_NO_ERROR;
            if (!d.visit_date) return "Visit date is required.";
            if (!d.location_id) return "Location is required.";
            return null;
          }}
          onSave={saved((d: VisitInfoDraft) => updateVisitDetails(visitId, {
            queue_no: d.queue_no.trim().toUpperCase(),
            visit_date: d.visit_date,
            location_id: Number(d.location_id),
          }))}
        />
        <EditableRecordSection
          title="Vitals"
          record={drafts.vitals}
          fields={VITALS_FIELDS}
          canEdit={canEdit}
          emptyDraft={{ height: "", weight: "", bmi: "", below_3rd_percentile: false, bp_systolic: "", bp_diastolic: "", temperature: "", notes: "" }}
          derive={deriveBmi}
          validate={validateVitals}
          onSave={saved((d: VitalsDraft) => updateVisitVitals(visitId, {
            vitals: {
              ...d,
              bp_systolic: Number(d.bp_systolic),
              bp_diastolic: Number(d.bp_diastolic),
            },
          }))}
        />
        <EditableRecordSection
          title="HEF"
          record={drafts.hef}
          fields={HEF_FIELDS}
          canEdit={canEdit}
          emptyDraft={{ know_of_hef: false, has_hef: false, notes: "" }}
          onSave={saved((d: HefDraft) => updateVisitVitals(visitId, { hef: d }))}
        />
      </StationPanel>

      <StationPanel value="triage">
        <EditableRecordSection
          title="Visual Acuity"
          record={drafts.acuity}
          fields={ACUITY_FIELDS}
          canEdit={canEdit}
          emptyDraft={{ left_with_pinhole: "", left_without_pinhole: "", right_with_pinhole: "", right_without_pinhole: "", notes: "" }}
          onSave={saved((d: AcuityDraft) => saveVisualAcuity({ visit_id: visitId, ...d }))}
        />
        <EditableRecordSection
          title="Presenting Complaint"
          record={drafts.complaint}
          fields={COMPLAINT_FIELDS}
          canEdit={canEdit}
          emptyDraft={{ history: "", red_flags: "", systems_review: "", drug_allergies: "" }}
          onSave={saved((d: ComplaintDraft) => savePresentingComplaint({ visit_id: visitId, ...d }))}
        />
        <EditableRecordSection
          title="Medical History"
          record={drafts.history}
          fields={HISTORY_FIELDS}
          canEdit={canEdit}
          emptyDraft={{ past: "", drug_and_treatment: "", family: "", social: "", systems_review: "" }}
          onSave={saved((d: HistoryDraft) => saveMedicalHistory({ visit_id: visitId, ...d }))}
        />
      </StationPanel>

      <StationPanel value="seva">
        <EditableRecordSection
          title={`${PARTNER_NGO_NAME} Notes`}
          record={drafts.seva}
          fields={SEVA_FIELDS}
          canEdit={canEdit}
          emptyDraft={{
            left_with_pinhole_new: "", left_without_pinhole_new: "", right_with_pinhole_new: "", right_without_pinhole_new: "",
            diagnosis: "", referral: "", date_of_referral: "", notes: "",
          }}
          onSave={saved((d: SevaDraft) => postSeva({
            leftWithPinholeNew: d.left_with_pinhole_new,
            leftWithoutPinholeNew: d.left_without_pinhole_new,
            rightWithPinholeNew: d.right_with_pinhole_new,
            rightWithoutPinholeNew: d.right_without_pinhole_new,
            diagnosis: d.diagnosis,
            dateOfReferral: d.date_of_referral,
            referral: d.referral as SevaReferral | "",
            notes: d.notes,
          }, visitId))}
        />
      </StationPanel>

      <StationPanel value="physio">
        <EditableRecordSection
          title="Physiotherapy"
          record={drafts.physio}
          fields={PHYSIO_FIELDS}
          canEdit={canEdit}
          emptyDraft={{ notes: "", painpoints: [] }}
          onSave={saved((d: PhysioDraft) => postPhysiotherapy(d, visitId))}
        />
      </StationPanel>

      <StationPanel value="consult">
        <EditableRecordSection
          title="Consultation"
          record={drafts.consult}
          fields={CONSULT_FIELDS}
          canEdit={canEdit}
          emptyDraft={{ notes: "", prescription: "", condition_categories: null }}
          onSave={saved((d: ConsultDraft) => postConsultation({
            notes: d.notes,
            prescription: d.prescription,
            conditionCategories: d.condition_categories,
            requireReferral: visit.referrals.length > 0,
            referral: null,
          }, visitId))}
        />
        <EditableRecordSection
          title="Referral"
          record={drafts.referral}
          fields={REFERRAL_FIELDS}
          canEdit={canEdit}
          emptyMessage="No referral for this visit."
          readOnlyItems={visit.referrals[0]?.signer_name
            ? [{ label: "Signed By", value: visit.referrals[0].signer_name }]
            : []}
          editHint="The saved signature is kept unchanged. To re-sign, open the referral from the Consult page."
          onSave={saved((d: ReferralDraft) => postReferral({
            referralDate: d.referral_date,
            referralType: d.destinations,
            illness: d.illness,
            duration: d.duration,
            reason: d.reason,
            // Resending the saved strokes keeps the original signer and signing time.
            signature: visit.referrals[0]?.signature ?? null,
          }, visitId))}
        />
      </StationPanel>
    </Tabs>
  );
}
