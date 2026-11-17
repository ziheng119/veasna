"use client";

import { ComponentProps, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { INPUT_FORMAT_HINTS, InputFormat, matchesFormat } from "@/lib/inputFormats";

// On-screen keyboard for each format: a number pad where only numbers can be typed.
const INPUT_MODES: Record<InputFormat, ComponentProps<"input">["inputMode"]> = {
  measurement: "decimal",
  temperature: "decimal",
  wholeNumber: "numeric",
  phone: "tel",
};

// How long the "numbers only" hint stays after a refused keystroke.
const HINT_MS = 2500;

type Props = Omit<ComponentProps<typeof Input>, "type" | "onChange" | "value"> & {
  format: InputFormat;
  value: string;
  // Called only with text that matches the format; other keystrokes leave the field unchanged.
  onValueChange: (value: string) => void;
};

/** A text field that accepts only what its format allows, as the user types or pastes. A refused
 *  keystroke shows a short hint under the field, so it doesn't look like the keyboard failed. */
export default function FilteredInput({ format, value, onValueChange, ...props }: Props) {
  const [refused, setRefused] = useState(0);
  useEffect(() => {
    if (!refused) return;
    const timer = setTimeout(() => setRefused(0), HINT_MS);
    return () => clearTimeout(timer);
  }, [refused]);

  return (
    <>
      <Input
        {...props}
        type="text"
        inputMode={INPUT_MODES[format]}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          if (matchesFormat(event.target.value, format)) {
            onValueChange(event.target.value);
            setRefused(0);
          } else {
            setRefused(Date.now());
          }
        }}
      />
      <p role="status" className={refused ? "mt-1 text-xs text-muted-foreground" : "sr-only"}>
        {refused ? INPUT_FORMAT_HINTS[format] : ""}
      </p>
    </>
  );
}
