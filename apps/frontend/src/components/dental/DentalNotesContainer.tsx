"use client";

import { useEffect, useId, useState } from "react";
import toast from "react-hot-toast";
import SaveButton from "../shared/SaveButton";
import { SaveAndNextButton, StationDonePrompt, useSaveBeforeNext } from "../shared/StationFlow";
import SavedRecordFields from "@/components/shared/SavedRecordFields";
import { PageCard } from "../shared/PageCard";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSavedRecordAccess } from "@/hooks/useSavedRecordAccess";
import { getDental, postDental } from "@/lib/api/visit/dental";
import { QueuedPatient } from "@/lib/types/patient";

interface Props {
  patient: QueuedPatient;
}

/** What the dental students did, and whether the doctor should refer the patient on. */
export default function DentalNotesContainer({ patient }: Props) {
  const { editable, saved, markSaved, savedVersion } = useSavedRecordAccess(patient.visit_id);
  const notesId = useId();
  const referralId = useId();
  const [notes, setNotes] = useState("");
  const [referralNeeded, setReferralNeeded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getDental(patient.visit_id, controller.signal)
      .then((data) => {
        markSaved(data !== null);
        setNotes(data?.notes ?? "");
        setReferralNeeded(data?.referral_needed ?? false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Error loading dental notes:", error);
        toast.error("Failed to load dental notes");
      });
    return () => controller.abort();
  }, [patient.visit_id, markSaved]);

  // Resolves to whether the notes were saved.
  const handleSave = async (): Promise<boolean> => {
    if (!editable) return false;
    try {
      await postDental(patient.visit_id, { notes, referral_needed: referralNeeded });
      markSaved();
      toast.success("Dental notes saved");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save dental notes");
      return false;
    }
  };
  // Next on the queue card saves these notes first.
  useSaveBeforeNext(patient.visit_id, savedVersion, { notes, referralNeeded }, handleSave);

  return (
    <PageCard title="Dental Notes" className="xl:col-span-4" contentClassName="space-y-4">
      <StationDonePrompt patient={patient} done={saved} />
      <SavedRecordFields locked={!editable}>
        <div className="space-y-2">
          <Label htmlFor={notesId}>What was done</Label>
          <Textarea
            id={notesId}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. Cleaned teeth, extracted lower left molar"
            rows={6}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={referralId}
            checked={referralNeeded}
            onCheckedChange={(checked) => setReferralNeeded(checked === true)}
          />
          <Label htmlFor={referralId}>Referral needed</Label>
        </div>
        <p className="text-xs text-muted-foreground">The doctor sees these notes at Consult and refers the patient to a hospital if needed.</p>
        <div className="flex items-center justify-end gap-2">
          <SaveButton onClick={handleSave} disabled={!editable} />
          <SaveAndNextButton patient={patient} onSave={handleSave} ready={saved || notes.trim() !== ""} locked={saved && !editable}
            disabled={!editable && !saved} hint="Write what was done to finish" />
        </div>
      </SavedRecordFields>
    </PageCard>
  );
}
