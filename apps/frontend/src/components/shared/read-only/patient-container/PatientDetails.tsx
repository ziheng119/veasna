"use client";

import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import LabelDescriptionPair from "../../LabelDescPair";
import { getPatient } from "@/lib/api/patients/getPatient";
import { useEffect, useState } from "react";
import Loading from "../../Loading";
import NoDataAvailable from "../../NoDataAvailable";
import { PATIENT } from "@/constants/strings";

interface Props {
  patient: QueuedPatient;
}

export default function PatientDetails({ patient }: Props) {
  const [patientDetails, setPatientDetails] = useState<PatientInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to calculate age
  const getAge = (dob: string | null) => {
    if (!dob) return "N/A";
    const birthDate = new Date(dob);
    const diff = new Date().getTime() - birthDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)).toString();
  };

  useEffect(() => {
    if (!patient?.patient_id) {
      setPatientDetails(null);
      return;
    }

    const fetchPatient = async () => {
      setLoading(true);
      try {
        const data = await getPatient(patient.patient_id!);
        setPatientDetails(data);
      } catch (err) {
        console.error("Failed to fetch patient:", err);
        setPatientDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [patient]);

  if (loading) return <Loading />;
  if (!patientDetails) return <NoDataAvailable dataString={PATIENT} />;

  return (
    <div className="flex flex-col gap-4 w-full">
      <h1 className="font-semibold text-[20px]">Patient Details</h1>
      <div className="flex flex-col gap-2 justify-between">
        <LabelDescriptionPair 
          label="English Name"
          description={patientDetails.english_name || "N/A"}
        />
        <LabelDescriptionPair 
          label="Khmer Name"
          description={patientDetails.khmer_name || "N/A"}
        />
        <LabelDescriptionPair 
          label="Date of Birth"
          description={patientDetails.date_of_birth || "N/A"}
        />
        <LabelDescriptionPair 
          label="Age"
          description={getAge(patientDetails.date_of_birth)}
        />
        <LabelDescriptionPair 
          label="Sex"
          description={patientDetails.sex || "N/A"}
        />
        <LabelDescriptionPair 
          label="Phone Number"
          description={patientDetails.phone_number || "N/A"}
        />
      </div>
    </div>
  );
}
