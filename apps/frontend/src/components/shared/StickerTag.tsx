"use client";

import { cn } from "@/lib/utils";
import { useFormOptions } from "@/stores/useFormOptionsStore";
import type { FormOption } from "@/lib/types/formOptions";

// Shown for a sticker whose colour was later removed from the list.
const UNKNOWN_COLOUR = "#9ca3af";

export type Sticker = { label: string; colour: string };

/** The sticker saved on a visit (an id from the sticker_colours list), or null if none. */
export function findSticker(colours: FormOption[], id?: string | null): Sticker | null {
  if (!id) return null;
  const match = colours.find((option) => option.id === id);
  return { label: match?.label ?? id.replace(/_/g, " "), colour: match?.colour ?? UNKNOWN_COLOUR };
}

/** The current sticker colours, for findSticker. */
export function useStickerColours(): FormOption[] {
  return useFormOptions("sticker_colours");
}

/** Words for a screen reader, e.g. ", light blue sticker"; empty when there is no sticker. */
export function stickerLabel(sticker: Sticker | null): string {
  return sticker ? `, ${sticker.label.toLowerCase()} sticker` : "";
}

interface Props {
  sticker: Sticker | null;
  // Pinned to the corner of the queue number (its parent must be `relative`), or inline.
  pinned?: boolean;
  className?: string;
}

/**
 * A small square "sticky note" in the patient's sticker colour, with a folded corner and a slight
 * tilt, so staff can match the card to the sticker on the patient.
 */
export default function StickerTag({ sticker, pinned = false, className }: Props) {
  if (!sticker) return null;
  return (
    <span
      aria-hidden="true"
      title={`${sticker.label} sticker`}
      data-sticker
      className={cn(
        "sticker-tag inline-block size-[18px] shrink-0 rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.35)] ring-1 ring-black/25 dark:ring-white/30",
        pinned ? "absolute -right-2 -top-2 rotate-12" : "rotate-6",
        className,
      )}
      style={{
        backgroundColor: sticker.colour,
        // A folded top-right corner and a little sheen, so it reads as a sticker.
        backgroundImage:
          "linear-gradient(225deg, rgba(0,0,0,0.28) 0 18%, rgba(255,255,255,0.35) 18% 22%, transparent 22%), linear-gradient(135deg, rgba(255,255,255,0.45), transparent 55%)",
      }}
    />
  );
}

/** A saved sticker colour as a swatch and its name, or "No sticker". */
export function StickerColourValue({ id }: { id?: string | null }) {
  const sticker = findSticker(useStickerColours(), id);
  if (!sticker) return <span className="text-muted-foreground">No sticker</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <StickerTag sticker={sticker} />
      {sticker.label}
    </span>
  );
}
