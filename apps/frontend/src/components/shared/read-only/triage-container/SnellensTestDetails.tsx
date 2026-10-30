"use client";

import { QueuedPatient } from "@/lib/types/patient";
import VerticalLabelInputPair from "../../VerticalLabelInputPair";
import { useEffect, useState } from "react";
import { getVisualAcuity } from "@/lib/api/visit/getSnellensTest";
import { VisualAcuity } from "@/lib/types/visualAcuity";
import Loading from "../../Loading";
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
    // A single line rather than the large empty-state box: this section is low priority here.
    return <p className="text-xs text-muted-foreground">No {SNELLENS_TEST} recorded for this visit.</p>;
  }

  // Low priority on this screen: collapsed by default, smaller text.
  return (
    <details className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
      <summary className="cursor-pointer select-none font-medium">
        Snellen&apos;s Test
        <span className="ml-2 font-normal">
          L {visualAcuity.left_without_pinhole ?? "N/A"} · R {visualAcuity.right_without_pinhole ?? "N/A"} (without pinhole)
        </span>
      </summary>
      <div className="mt-2 flex flex-col gap-0 text-foreground">
        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 items-center w-full">
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
    </details>
  )
}
