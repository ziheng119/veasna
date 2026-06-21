"use client";

import { QueuedPatient } from "@/lib/types/patient";
import VerticalLabelInputPair from "../../VerticalLabelInputPair";
import { useEffect, useState } from "react";
import { getVisualAcuity } from "@/lib/api/visit/getSnellensTest";
import { VisualAcuity } from "@/lib/types/visualAcuity";
import Loading from "../../Loading";
import NoDataAvailable from "../../NoDataAvailable";
import { SNELLENS_TEST } from "@/constants/strings";

interface Props {
  patient: QueuedPatient;
}

export default function SnellensTestDetails({ patient }: Props) {
  const [visualAcuity, setVisualAcuity] = useState<VisualAcuity | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchVisualAcuity = async () => {
      setLoading(true);
      try {
        const data = await getVisualAcuity(patient.patient_id, patient.visit_id);
        setVisualAcuity(data);
      } catch (err) {
        console.error("Failed to fetch visual acuity:", err);
        setVisualAcuity(null);
      } finally {
        setLoading(false);
      }
    };

    fetchVisualAcuity();
  }, [patient]);

  if (loading) {
    return (
      <Loading />
    );
  }

  if (!visualAcuity) {
    return (
      <NoDataAvailable dataString={SNELLENS_TEST}/>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <h2 className="text-[20px] font-semibold">Snellen&apos;s Test</h2>
      <div className="flex flex-col gap-0">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-[30px] items-center w-full">
          <p className="text-start font-semibold">Visual Acuity</p>
          <p className="text-center font-semibold">Left (OS)</p>
          <p className="text-center font-semibold">Right (OD)</p>

          <p className="text-start">With Pinhole</p>
          <p className="text-center">{visualAcuity.left_with_pinhole ?? "N/A"}</p>
          <p className="text-center">{visualAcuity.right_with_pinhole ?? "N/A"}</p>

          <p className="text-start">Without Pinhole</p>
          <p className="text-center">{visualAcuity.left_without_pinhole ?? "N/A"}</p>
          <p className="text-center">{visualAcuity.right_without_pinhole ?? "N/A"}</p>

          {/* Additional Notes span all columns */}
          <div className="col-span-3 w-full">
            <VerticalLabelInputPair
              label="Additional Notes"
              bolded={false}
              value={visualAcuity.notes || "N/A"}
              readOnly={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
