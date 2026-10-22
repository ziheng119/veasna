"use client";

import SavedRecordFields from "@/components/shared/SavedRecordFields";
import { useSavedRecordAccess } from "@/hooks/useSavedRecordAccess";
import { useEffect, useState } from "react";
import SaveButton from "../shared/SaveButton";
import VerticalLabelInputPair from "../shared/VerticalLabelInputPair";
import toast from "react-hot-toast";
import { Seva } from "@/lib/types/seva";
import { QueuedPatient } from "@/lib/types/patient";
import { getSeva } from "@/lib/api/visit/seva/getSeva";
import { postSeva } from "@/lib/api/visit/seva/postSeva";
import formatDate from "@/helper/format_date";
import { PageCard } from "../shared/PageCard";
import SnellenInput from "../shared/SnellenInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEVA_REFERRALS, SevaReferral } from "@/constants/sevaReferral";
import { normalizeSnellenFields, SNELLEN_ERROR } from "@/lib/snellen";

// Radix Select items cannot have an empty value, so "no referral" needs a stand-in.
const NO_REFERRAL = "none";

interface Props {
  patient: QueuedPatient;
}

export default function SevaNotesContainer({ patient }: Props) {
  const { editable, markSaved } = useSavedRecordAccess(patient.visit_id);
  const [leftWithPinholeNew, setLeftWithPinholeNew] = useState<string>("");
  const [rightWithPinholeNew, setRightWithPinholeNew] = useState<string>("");
  const [leftWithoutPinholeNew, setLeftWithoutPinholeNew] =
    useState<string>("");
  const [rightWithoutPinholeNew, setRightWithoutPinholeNew] =
    useState<string>("");
  const [diagnosis, setDiagnosis] = useState<string>("");
  const [dateOfReferral, setDateOfReferral] = useState<string>("");
  const [referral, setReferral] = useState<SevaReferral | "">("");
  const [additionalNotes, setAdditionalNotes] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const data: Seva | null = await getSeva(patient.visit_id);
        if (cancelled) return;
        markSaved(data !== null);

        if (!data) {
          setLeftWithPinholeNew("");
          setLeftWithoutPinholeNew("");
          setRightWithPinholeNew("");
          setRightWithoutPinholeNew("");
          setDiagnosis("");
          setDateOfReferral("");
          setReferral("");
          setAdditionalNotes("");
          toast("No data loaded");
          return;
        }

        setLeftWithPinholeNew(data.leftWithPinholeNew);
        setLeftWithoutPinholeNew(data.leftWithoutPinholeNew);
        setRightWithPinholeNew(data.rightWithPinholeNew);
        setRightWithoutPinholeNew(data.rightWithoutPinholeNew);
        setDiagnosis(data.diagnosis);
        setDateOfReferral(
          data.dateOfReferral ? formatDate(data.dateOfReferral) : "",
        );
        setReferral(data.referral);
        setAdditionalNotes(data.notes ?? "");

        toast.success("Load success");
      } catch (error) {
        if (cancelled) return;
        toast.error("Failed to load SEVA data");
        console.error("Error loading SEVA:", error);
      }
    };
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [patient.visit_id, markSaved]);

  const handleSave = async () => {
    if (!editable) return;
    const fractions = normalizeSnellenFields({
      leftWithPinholeNew,
      leftWithoutPinholeNew,
      rightWithPinholeNew,
      rightWithoutPinholeNew,
    });
    if (!fractions) {
      toast.error(SNELLEN_ERROR);
      return;
    }

    const data: Seva = {
      ...fractions,
      diagnosis: diagnosis,
      dateOfReferral: dateOfReferral,
      referral: referral,
      notes: additionalNotes,
    };

    try {
      await postSeva(data, patient.visit_id);
      markSaved();
      toast.success("Save Success");
    } catch (error) {
      toast.error("An error has occurred");
    }
  };

  return (
    <PageCard
      title="Seva Notes"
      className="xl:col-span-4"
      contentClassName="space-y-4"
    >
      <SavedRecordFields locked={!editable}>
        <h2 className="text-[20px] font-semibold text-foreground">
          New Snellen&apos;s Test
        </h2>
        <div className="min-h-70 flex flex-col">
          {/* One reading per row so the dropdown has room in the narrow panel */}
          <p className="font-semibold text-start mb-2">Visual Acuity</p>
          <div className="grid grid-cols-[1fr_9rem] gap-x-3 gap-y-2 mb-[30px] items-center">
            <p className="text-start">Left (OS), with pinhole</p>
            <SnellenInput
              value={leftWithPinholeNew}
              onChange={setLeftWithPinholeNew}
            />

            <p className="text-start">Right (OD), with pinhole</p>
            <SnellenInput
              value={rightWithPinholeNew}
              onChange={setRightWithPinholeNew}
            />

            <p className="text-start">Left (OS), without pinhole</p>
            <SnellenInput
              value={leftWithoutPinholeNew}
              onChange={setLeftWithoutPinholeNew}
            />

            <p className="text-start">Right (OD), without pinhole</p>
            <SnellenInput
              value={rightWithoutPinholeNew}
              onChange={setRightWithoutPinholeNew}
            />
          </div>

          <VerticalLabelInputPair
            label="Diagnosis"
            onChangeFunction={setDiagnosis}
            value={diagnosis}
          />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <h2 className="text-[15px] font-semibold">Referral needed</h2>
          <Select
            value={referral || NO_REFERRAL}
            onValueChange={(value) =>
              setReferral(value === NO_REFERRAL ? "" : (value as SevaReferral))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              avoidCollisions={false}
              className="bg-popover border-border"
            >
              <SelectItem value={NO_REFERRAL}>No referral</SelectItem>
              {SEVA_REFERRALS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <h2 className="text-[15px] font-semibold">Date of Referral</h2>
          <input
            type="date"
            placeholder="DD/MM/YYYY"
            className="bg-background border border-input rounded-sm p-2 w-40 text-foreground"
            onChange={(e) => setDateOfReferral(e.target.value)}
            value={dateOfReferral}
          />
        </div>

        <div className="flex w-full">
          <VerticalLabelInputPair
            label="Additional Notes"
            onChangeFunction={setAdditionalNotes}
            value={additionalNotes}
          />
        </div>

        <div className="flex items-center justify-end">
          <SaveButton onClick={handleSave} />
        </div>
      </SavedRecordFields>
    </PageCard>
  );
}
