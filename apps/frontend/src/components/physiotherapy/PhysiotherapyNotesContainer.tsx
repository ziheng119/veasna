"use client";

import VerticalLabelInputPair from "../shared/VerticalLabelInputPair";
import SaveButton from "../shared/SaveButton";
import { SaveAndNextButton, StationDonePrompt, useSaveBeforeNext } from "../shared/StationFlow";
import { LiveRecordNotice, useLiveRecord } from "../shared/LiveRecord";
import DottedImage from "./DottedImage";
import SavedRecordFields from "@/components/shared/SavedRecordFields";
import { useSavedRecordAccess } from "@/hooks/useSavedRecordAccess";
import { useCallback, useState } from "react";
import { PainPoint, Physiotherapy } from "@/lib/types/physiotherapy";
import { getPhysiotherapy } from "@/lib/api/visit/physiotherapy/getPhysiotherapy";
import { QueuedPatient } from "@/lib/types/patient";
import toast from "react-hot-toast";
import { postPhysiotherapy } from "@/lib/api/visit/physiotherapy/postPhysiotherapy";
import { PageCard } from "../shared/PageCard";
import { useRecordLoad } from "@/hooks/useRecordLoad";

interface Props {
  patient: QueuedPatient;
}

export default function PhysiotherapyNotesContainer({ patient }: Props) {
  const { editable, saved, markSaved, savedVersion } = useSavedRecordAccess(patient.visit_id);

  const [notes, setNotes] = useState<string>("");
  const [painpoints, setPainpoints] = useState<PainPoint[]>([]);

  const load = useCallback(() => getPhysiotherapy(patient.visit_id), [patient.visit_id]);
  const show = useCallback((data: Physiotherapy | null) => {
    markSaved(data !== null);
    setNotes(data?.notes ? data.notes : "");
    setPainpoints(data?.painpoints ?? []);
  }, [markSaved]);

  useRecordLoad(load, show, "Couldn't load the physiotherapy notes");

  // Resolves to whether the notes were saved.
  const handleSave = async (): Promise<boolean> => {
    if (!editable) return false;
    try {
      const data: Physiotherapy = {
        notes: notes,
        painpoints: painpoints,
      };

      await postPhysiotherapy(data, patient.visit_id);
      markSaved();
      toast.success("Save Success");
      return true;
    } catch (error) {
      toast.error("An error has occurred");
      return false;
    }
  };
  // Next on the queue card saves these notes and the body chart first.
  useSaveBeforeNext(patient.visit_id, savedVersion, { notes, painpoints }, handleSave);
  // Saves made for this visit on another device show here too.
  const live = useLiveRecord({
    visitId: patient.visit_id, savedVersion, values: { notes, painpoints }, load, apply: show,
    valuesOf: (data) => ({ notes: data?.notes ? data.notes : "", painpoints: data?.painpoints ?? [] }),
    draft: { form: "physiotherapy", restore: (draft: { notes: string; painpoints: PainPoint[] }) => {
      setNotes(draft.notes);
      setPainpoints(draft.painpoints);
    } },
  });

  return (
    <PageCard
      title="Physiotherapy Notes"
      className="xl:col-span-4"
      contentClassName="space-y-4"
    >
      <StationDonePrompt patient={patient} done={saved} />
      <LiveRecordNotice live={live} />
      <SavedRecordFields locked={!editable}>
        <div className="flex w-full">
          <VerticalLabelInputPair onChangeFunction={setNotes} value={notes} />
        </div>

        <div>
          <h2 className="text-[20px] font-semibold">Body Chart Indication</h2>
          <div className="flex flex-row w-full">
            <DottedImage
              imageUrl="/bodychart.jpg"
              onClickFunction={setPainpoints}
              positions={painpoints}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <SaveButton onClick={handleSave} disabled={!editable} />
          <SaveAndNextButton patient={patient} onSave={handleSave} ready={saved || notes.trim() !== "" || painpoints.length > 0}
            locked={saved && !editable} disabled={!editable && !saved} hint="Write notes or mark the body chart to finish" />
        </div>
      </SavedRecordFields>
    </PageCard>
  );
}
