"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonIcon } from "@/assets/icons";
import EditableRecordSection, { FieldOption, FieldSpec } from "./EditableRecordSection";
import { calculateAge } from "@/helper/calculate_age";
import { updatePatient } from "@/lib/api/patient/updatePatient";
import { PatientInfo } from "@/lib/types/patient";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserStore } from "@/stores/useUserStore";

type PatientDraft = {
  english_name: string;
  khmer_name: string;
  date_of_birth: string;
  sex: string;
  phone_number: string;
  address: string;
  location_id: string;
};

const SEX_OPTIONS: FieldOption[] = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

// The patient record as returned by GET /api/patient/:id.
export type PatientRecord = PatientInfo & {
  last_updated_at?: string;
  location_name?: string | null;
};

interface Props {
  patient: PatientRecord;
  canEdit: boolean;
  onSaved: (patient: PatientRecord) => void;
}

/** Demographics of the patient. Admins can correct them; the Unique ID is regenerated on save. */
export default function PatientInfoCard({ patient, canEdit, onSaved }: Props) {
  const token = useUserStore((state) => state.user?.token);
  const locations = useLocationStore((state) => state.locations);

  const record = useMemo<PatientDraft>(() => ({
    english_name: patient.english_name ?? "",
    khmer_name: patient.khmer_name ?? "",
    date_of_birth: patient.date_of_birth ? patient.date_of_birth.split("T")[0] : "",
    sex: patient.sex ?? "",
    phone_number: patient.phone_number ?? "",
    address: patient.address ?? "",
    location_id: patient.location_id ? String(patient.location_id) : "",
  }), [patient]);

  const locationOptions = useMemo<FieldOption[]>(() => {
    const options = locations.map((l) => ({ value: String(l.id), label: l.name }));
    // Keep an inactive or not-yet-loaded location selectable so saving does not change it.
    if (patient.location_id && !options.some((o) => o.value === String(patient.location_id))) {
      options.unshift({ value: String(patient.location_id), label: patient.location_name ?? `Location ${patient.location_id}` });
    }
    return options;
  }, [locations, patient.location_id, patient.location_name]);

  const fields: FieldSpec<PatientDraft>[] = [
    { key: "english_name", label: "English Name", kind: "text" },
    { key: "khmer_name", label: "Khmer Name", kind: "text" },
    { key: "date_of_birth", label: "Date of Birth", kind: "date" },
    { key: "sex", label: "Sex", kind: "select", options: SEX_OPTIONS },
    { key: "phone_number", label: "Phone Number", kind: "text" },
    { key: "location_id", label: "Registered Location", kind: "select", options: locationOptions },
    { key: "address", label: "Address", kind: "textarea", wide: true },
  ];

  const age = calculateAge(patient.date_of_birth);
  const lastUpdated = patient.last_updated_at ?? patient.lastUpdated;

  const save = async (draft: PatientDraft) => {
    if (!token) throw new Error("User not authenticated");
    const result = await updatePatient(patient.id, {
      ...draft,
      sex: draft.sex as PatientInfo["sex"],
      location_id: draft.location_id ? Number(draft.location_id) : undefined,
    }, token);
    if (!result.success) throw new Error(result.error);
    onSaved(result.data.patient);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <PersonIcon className="h-8 w-8 text-primary" />
          <div>
            <CardTitle className="text-xl">{patient.english_name || "N/A"}</CardTitle>
            <CardDescription>{patient.khmer_name || "N/A"}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <EditableRecordSection
          title="Patient Information"
          record={record}
          fields={fields}
          canEdit={canEdit}
          framed={false}
          editHint="The Unique ID is regenerated from the names and date of birth when you save."
          readOnlyItems={[
            { label: "Unique ID", value: patient.face_id || "N/A" },
            { label: "Age", value: age === null ? "N/A" : `${age} years` },
            { label: "Last Updated", value: lastUpdated ? new Date(lastUpdated).toLocaleString() : "N/A" },
          ]}
          validate={(d) => {
            if (!d.english_name.trim()) return "English name is required.";
            if (!d.date_of_birth) return "Date of birth is required.";
            if (!d.sex) return "Sex is required.";
            return null;
          }}
          onSave={save}
        />
      </CardContent>
    </Card>
  );
}
