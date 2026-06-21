"use client"

import { calculateAge } from "@/helper/calculate_age";
import { postReferral } from "@/lib/api/visit/postReferral";
import { Referral } from "@/lib/types/consultation";
import { PatientInfo, QueuedPatient } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";
import { Ref, useState } from "react";
import toast from "react-hot-toast";

interface Props {
  patient: QueuedPatient;
  patientInfo: PatientInfo;
  retrievedReferral: Referral | null
  onClose: () => void; // Add this prop
}

export default function ReferralForm({ patient, patientInfo, retrievedReferral, onClose }: Props) {

  const [referralDate, setReferralDate] = useState<string>(retrievedReferral? retrievedReferral.referralDate : "")
  const [referralType, setReferralType] = useState<string[]>(
    retrievedReferral?.referralType ?? []
  );
  const [illness, setIllness] = useState<string>(retrievedReferral? retrievedReferral.illness : "")
  const [duration, setDuration] = useState<string>(retrievedReferral ? retrievedReferral.duration : "")
  const [reason, setReason] = useState<string>(retrievedReferral ? retrievedReferral.reason : "")

  const user = useUserStore((state) => state.user)

  const handleSave = async () => {
    const data: Referral = {
      referralDate: referralDate,
      referralType: referralType,
      illness: illness,
      duration: duration,
      reason: reason,
    }
    
    try {
      const res = await postReferral(data, patient.visit_id)
      setReferralDate("");
      setReferralType([]);
      setIllness("");
      setDuration("")
      setReason("")
      toast.success("Save Success")
    } catch (error) {
      toast.error("An error as occured")
    }
  }

  return (
    <div className="px-6 py-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Referral</h2>

      <form className="flex flex-col space-y-6">
        {/* Date */}
        <div>
          <label className="flex items-center gap-x-4 font-medium">
            Date of Referral:
            <input
              type="date"
              className="border p-2 rounded flex-1 bg-white-default"
              value={referralDate}
              onChange={e => setReferralDate(e.target.value)}
            />
          </label>
        </div>

        {/* Referral Types */}
        <div>
          <p className="font-medium mb-2">Referral Type Needed:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              "MongKol Borey Hospital",
              "Poipett Referral Hospital",
              "SEVA",
              "Optometrist",
              "Dentist",
              "Bong Bondol",
            ].map((referral) => (
              <label key={referral} className="flex items-center gap-x-2">
                <input 
                  type="checkbox" 
                  name="referral" 
                  value={referral}
                  checked={referralType.includes(referral)}
                  onChange={(e) => {
                    const { checked, value } = e.target;
                    setReferralType((prev) => 
                      checked 
                        ? [...prev, value]                     // add if checked
                        : prev.filter((item) => item !== value) // remove if unchecked
                    );
                  }}
                />
                {referral}
              </label>
            ))}
          </div>
        </div>

        {/* Patient Info */}
        <div>
          <p className="mb-2 font-medium">To whomever it may concern</p>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-x-2"> {/* row layout */}
              <span>Patient Name:</span>
              <p>{patientInfo.english_name}</p>
            </label>
            <label className="flex items-center gap-x-2">
              <span>Patient Gender:</span>
              <p>{patientInfo.sex}</p>
            </label>
            <label className="flex items-center gap-x-2">
              <span>Patient Age:</span>
              <p>{calculateAge(patientInfo.date_of_birth)}</p>
            </label>
            <label className="flex items-center gap-x-2">
              <span>Patient Address:</span>
              <p>{patientInfo.address === "" ? "N/A" : patientInfo.address}</p>
            </label>
          </div>
        </div>

        {/* Condition */}
        <div>
          <p>
            The patient above has been suffering from{" "}
            <input
              className="bg-white-default border rounded p-1"
              placeholder="illness"
              value={illness}
              onChange={e => setIllness(e.target.value)}
            />{" "}
            for{" "}
            <input
              className="bg-white-default border rounded p-1"
              placeholder="duration"
              value={duration}
              onChange={e => setDuration(e.target.value)}
            />
          </p>
        </div>

        {/* Reason */}
        <div>
          <p className="font-medium mb-2">Reason for referral:</p>
          <textarea 
            className="bg-white-default border rounded p-2 w-full h-24" 
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {/* Closing */}
        <p className="italic">Thank you.</p>
        <p>{user?.username}</p>

        {/* Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => {
              handleSave()
              onClose()
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            onClick={e => onClose()}
          >
            Print
          </button>
        </div>
      </form>
    </div>
  );
}
