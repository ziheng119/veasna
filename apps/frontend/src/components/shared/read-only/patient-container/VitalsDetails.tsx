"use client";

import { QueuedPatient } from "@/lib/types/patient";
import { useVisitChanges } from "@/hooks/useVisitChanges";
import LabelDescriptionPair from "../../LabelDescPair";
import { useEffect, useState } from "react";
import { getVitals } from "@/lib/api/visit/getVitals";
import { Vitals } from "@/lib/types/vitals";
import NoDataAvailable from "../../NoDataAvailable";
import { VITALS } from "@/constants/strings";
import Loading from "../../Loading";

interface Props {
  patient: QueuedPatient;
}

export default function VitalsDetails({ patient }: Props) {
  const [vitalsDetails, setVitalsDetails] = useState<Vitals | null>(null);
  const [loading, setLoading] = useState(false);
  // Saves elsewhere (e.g. Triage on another device) reload this quietly, without the spinner.
  const changes = useVisitChanges(patient.visit_id);

  useEffect(() => {  
    const fetchVitals = async () => {
      if (changes === 0) setLoading(true);
      try {
        const data = await getVitals(patient.patient_id, patient.visit_id);
        setVitalsDetails(data);
      } catch (err) {
        console.error("Failed to fetch vitals:", err);
        setVitalsDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchVitals();
  }, [patient, changes]);

  if (loading) {
    return (
      <Loading />
    );
  }

  if (!vitalsDetails) {
    return (
      <NoDataAvailable dataString={VITALS} />
    );
  }

  return (
    <div>
      <h2 className="text-[20px] font-semibold mb-2">Vitals</h2>
      <div className="flex flex-col gap-2 justify-between">
        <LabelDescriptionPair 
          label="Height"
          description={vitalsDetails.height?.toString() ?? "N/A"} 
        />
        <LabelDescriptionPair 
          label="Weight"
          description={vitalsDetails.weight?.toString() ?? "N/A"} 
        />
        <LabelDescriptionPair 
          label="BMI"
          description={vitalsDetails.bmi?.toString() ?? "N/A"} 
        />
        <LabelDescriptionPair 
          label="Child is below 3rd Percentile"
          description={vitalsDetails.below_3rd_percentile ? "Yes" : "No"} 
        />
        <LabelDescriptionPair 
          label="Blood Pressure"
          description={`${vitalsDetails.bp_systolic}/${vitalsDetails.bp_diastolic}`} 
        />
        <LabelDescriptionPair 
          label="Temperature"
          description={vitalsDetails.temperature?.toString() ?? "N/A"} 
        />
      </div>
    </div>
  );
}
