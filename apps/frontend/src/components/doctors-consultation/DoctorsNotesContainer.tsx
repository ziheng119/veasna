"use client"

import { useEffect, useState } from "react";
import SaveButton from "../shared/SaveButton";
import VerticalLabelInputPair from "../shared/VerticalLabelInputPair";
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
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
  const [notes, setNotes] = useState<string>("")
  const [prescription, setPrescription] = useState<string>("")
  const [referralNeeded, setReferralNeeded] = useState<boolean>(false)
  const [referral, setReferral] = useState<Referral | null>(null)


  const handleSave = async () => {
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
      toast.error("An error has occurred")
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
      className="xl:col-span-4"
      contentClassName="space-y-4"
    >
      <div className="flex w-full h-[40%]">
        <VerticalLabelInputPair 
          value={notes}
          onChangeFunction={setNotes}
        />
      </div>

      <h2 className="text-[20px] font-semibold">Prescription</h2>
      <div className="flex w-full h-[40%]">
        <VerticalLabelInputPair 
          value={prescription}
          onChangeFunction={setPrescription}
        />
      </div>

      <div className="flex gap-4">
        <h2 className="text-[20px] font-semibold">Referral Needed</h2>
        
        <div className="flex gap-2 items-center">
          <input
            type="radio"
            name="referralNeeded"
            value="yes"
            checked={referralNeeded === true}
            onChange={() => setReferralNeeded(true)}
            className="accent-primary"
          />
          <p>Yes</p>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="radio"
            name="referralNeeded"
            value="no"
            checked={referralNeeded === false}
            onChange={() => setReferralNeeded(false)}
            className="accent-primary"
          />
          <p>No</p>
        </div>
      </div>

      {patientInfo === null && (
        <Loading />
      )}
      
      {referralNeeded && patientInfo !== null && (
        <ReferralButton 
          patient={patient}
          patientInfo={patientInfo}
          retrievedReferral={referral}
        />
      )}

      <div className="flex items-center justify-end">
        <SaveButton 
          onClick={handleSave}
        />
      </div>
    </PageCard>
  )
}