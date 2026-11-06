"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import StickerTag, { findSticker, useStickerColours } from "./StickerTag";

// Radix Select items cannot have an empty value, so "no sticker" needs a stand-in.
const NONE = "none";

interface Props {
  id?: string;
  // Id from the sticker_colours list (Station data), or "" for no sticker.
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Dropdown of sticker colours, each with its swatch. */
export default function StickerColourSelect({ id, value, onChange, className }: Props) {
  const colours = useStickerColours();
  // Keep a saved colour selectable even if it was removed from the list since.
  const options = value && !colours.some((colour) => colour.id === value)
    ? [{ id: value, ...findSticker(colours, value)! }, ...colours]
    : colours;

  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder="No sticker" />
      </SelectTrigger>
      <SelectContent side="bottom" avoidCollisions={false} className="max-h-72 bg-popover border-border">
        <SelectItem value={NONE}>No sticker</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span className="flex items-center gap-2">
              <StickerTag sticker={{ label: option.label, colour: option.colour ?? "#9ca3af" }} className="size-3.5" />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
