"use client";

import { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { InputFormat, matchesFormat } from "@/lib/inputFormats";

// On-screen keyboard for each format: a number pad where only numbers can be typed.
const INPUT_MODES: Record<InputFormat, ComponentProps<"input">["inputMode"]> = {
  measurement: "decimal",
  temperature: "decimal",
  wholeNumber: "numeric",
  phone: "tel",
  queueNo: "text",
};

type Props = Omit<ComponentProps<typeof Input>, "type" | "onChange" | "value"> & {
  format: InputFormat;
  value: string;
  // Called only with text that matches the format; other keystrokes leave the field unchanged.
  onValueChange: (value: string) => void;
  // Applied before checking, e.g. upper-casing a queue number.
  transform?: (value: string) => string;
};

/** A text field that accepts only what its format allows, as the user types or pastes. */
export default function FilteredInput({ format, value, onValueChange, transform, ...props }: Props) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={INPUT_MODES[format]}
      autoComplete="off"
      value={value}
      onChange={(event) => {
        const next = transform ? transform(event.target.value) : event.target.value;
        if (matchesFormat(next, format)) onValueChange(next);
      }}
    />
  );
}
