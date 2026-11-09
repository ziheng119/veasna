"use client";

import { QueuedPatient } from "@/lib/types/patient";
import { useVisitChanges } from "@/hooks/useVisitChanges";
import VerticalLabelInputPair from "../../VerticalLabelInputPair";
import { useEffect, useState } from "react";
import { getPresentingComplaint } from "@/lib/api/visit/getPresentingComplaints";
import { PresentingComplaint } from "@/lib/types/medicalHistory";
import Loading from "../../Loading";
import NoDataAvailable from "../../NoDataAvailable";
import { PRESENTING_COMPLAINTS } from "@/constants/strings";

interface Props {
  patient: QueuedPatient;
}

export default function PresentingComplaintsDetails({ patient }: Props) {
  const [complaint, setComplaint] = useState<PresentingComplaint | null>(null);
  const [loading, setLoading] = useState(false);
  // Saves elsewhere (e.g. Triage on another device) reload this quietly, without the spinner.
  const changes = useVisitChanges(patient.visit_id);

  useEffect(() => {
    const fetchComplaint = async () => {
      if (changes === 0) setLoading(true);
      try {
        const data = await getPresentingComplaint(patient.patient_id, patient.visit_id);
        setComplaint(data);
      } catch (err) {
        console.error("Failed to fetch presenting complaint:", err);
        setComplaint(null);
      } finally {
        setLoading(false);
      }
    };

    fetchComplaint();
  }, [patient, changes]);

  if (loading) {
    return (
      <Loading />
    );
  }

  if (!complaint) {
    return (
      <NoDataAvailable dataString={PRESENTING_COMPLAINTS} />
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <h2 className="text-[20px] font-semibold">Presenting Complaints</h2>

      <VerticalLabelInputPair
        label="History of Presenting Illness"
        bolded={false}
        value={complaint.history || "N/A"}
        readOnly
      />

      <VerticalLabelInputPair
        label="Red Flags"
        bolded={false}
        value={complaint.red_flags || "N/A"}
        readOnly
      />

      <VerticalLabelInputPair
        label="Systems Review"
        bolded={false}
        value={complaint.systems_review || "N/A"}
        readOnly
      />

      <VerticalLabelInputPair
        label="Drug Allergies"
        bolded={false}
        value={complaint.drug_allergies || "N/A"}
        readOnly
      />
    </div>
  );
}
