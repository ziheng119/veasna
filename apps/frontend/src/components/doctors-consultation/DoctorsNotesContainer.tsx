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

interface Props {
  patient: QueuedPatient;
}

export default function DoctorsNotesContainer({ patient }: Props) {
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
  const [notes, setNotes] = useState<string>("")
  const [prescription, setPrescription] = useState<string>("")
  const [referralNeeded, setReferralNeeded] = useState<boolean>(true)
  const [referral, setReferral] = useState<Referral | null>(null)

  const loadData = async () => {
    try {
      const data: Consultation | null = await getConsultation(patient.visit_id);

      if (!data) {
          toast("No data loaded")
          return;
      }

      setNotes(data.notes);
      setPrescription(data.prescription);
      setReferralNeeded(data.requireReferral);
      setReferral(data.referral)

      toast.success("Load success")

    } catch (error) {
        toast.error("Failed to load SEVA data");
        console.error("Error loading SEVA:", error);
    }
  };

  const handleSave = async () => {
    const data: Consultation = {
      notes: notes,
      prescription: prescription,
      requireReferral: referralNeeded,
      referral: referral      // is ignored by postConsultation
    }
    
    try {
      const res = await postConsultation(data, patient.visit_id)
      setNotes("");
      setPrescription("");
      setReferralNeeded(true);
      toast.success("Save Success")
    } catch (error) {
      toast.error("An error as occured")
    }
  }

  useEffect(() => {
    if (!patient?.patient_id) {
      toast.error("An error has occured")
      console.log("Invalid patient/patient id")
      setPatientInfo(null)
      return;
    }

    const fetchPatient = async () => {
      try {
        const data = await getPatient(patient.patient_id!);
        setPatientInfo(data);
      } catch (err) {
        toast.error("An error has occured")
        console.error("Failed to fetch patient:", err);
        setPatientInfo(null)
      }
    };

    fetchPatient();
  }, [patient]);

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="flex flex-col gap-4 bg-beige-default px-4 py-2 rounded-md border-[1px] lg:w-[30%]">
      <h2 className="text-[20px] font-semibold">Consultation Notes</h2>
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
          />
          <p>No</p>
        </div>
      </div>

      {patientInfo === undefined && (
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
    </div>
  )
}