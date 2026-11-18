"use client";

import { QueuedPatient } from "@/lib/types/patient";
import TbBadge from "./TbBadge";
import FamilyBadge from "./FamilyBadge";
import StickerTag, { findSticker, useStickerColours } from "./StickerTag";

const SEX_LABELS = { M: "Male", F: "Female" } as const;

/**
 * Who is open at a station, in one line above the form: queue number and sticker (as on their
 * queue card), names, age and sex, and the family and TB markers. Read from the queue, so it shows
 * at once and needs no request.
 */
export default function PatientHeader({ patient }: { patient: QueuedPatient }) {
  const sticker = findSticker(useStickerColours(), patient.sticker_colour);
  const facts = [
    patient.age != null && Number.isFinite(Number(patient.age)) ? `${patient.age} y` : null,
    patient.sex ? SEX_LABELS[patient.sex] : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="relative flex shrink-0">
        <span className={`min-w-[3.25rem] rounded-md px-2 py-1 text-center text-2xl font-bold leading-none tabular-nums ${
          patient.tb_flagged ? "bg-red-600 text-white" : "bg-primary text-primary-foreground"}`}>
          {patient.queue_no}
        </span>
        <StickerTag sticker={sticker} pinned />
      </span>
      {/* Age and sex sit under the name, with the Khmer name, so who they are reads as one block. */}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold leading-tight text-foreground">{patient.english_name || "Unknown name"}</h2>
        {(patient.khmer_name?.trim() || facts) && (
          <p className="truncate text-sm text-muted-foreground">
            {patient.khmer_name?.trim()}
            {patient.khmer_name?.trim() && facts && <span aria-hidden="true"> · </span>}
            {facts && <span className="tabular-nums text-foreground">{facts}</span>}
          </p>
        )}
      </div>
      {(patient.family || patient.tb_flagged) && (
        <span className="flex items-center gap-1.5">
          {patient.tb_flagged && <TbBadge />}
          {patient.family && <FamilyBadge family={patient.family} />}
        </span>
      )}
    </div>
  );
}
