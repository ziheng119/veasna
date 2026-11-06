"use client";

import { Fragment } from "react";
import SnellenInput from "./SnellenInput";

// Snellen readings in the order they are taken: without a pinhole, with one, then with the
// patient's own glasses. With glasses is optional (only for patients who brought glasses).
export const EYE_READING_ROWS = [
  { key: "without_pinhole", label: "Without pinhole" },
  { key: "with_pinhole", label: "With pinhole" },
  { key: "with_glasses", label: "With glasses", optional: true },
] as const;

type ReadingKind = (typeof EYE_READING_ROWS)[number]["key"];
export type EyeReadingField = `${"left" | "right"}_${ReadingKind}`;
export type EyeReadings = Record<EyeReadingField, string>;

export const EYE_READING_FIELDS: EyeReadingField[] = EYE_READING_ROWS.flatMap((row) => [
  `left_${row.key}` as const, `right_${row.key}` as const,
]);
// The readings every patient needs; with glasses is left out.
export const REQUIRED_EYE_READING_FIELDS: EyeReadingField[] = EYE_READING_FIELDS.filter((field) => !field.endsWith("_with_glasses"));

export const EMPTY_EYE_READINGS: EyeReadings = Object.fromEntries(EYE_READING_FIELDS.map((field) => [field, ""])) as EyeReadings;

interface Props {
  values: EyeReadings;
  onChange: (field: EyeReadingField, value: string) => void;
}

/** One row per kind of reading, one column per eye. */
export default function EyeReadingsGrid({ values, onChange }: Props) {
  return (
    <div className="grid grid-cols-[minmax(6.5rem,auto)_1fr_1fr] items-center gap-x-3 gap-y-3 text-sm">
      <span />
      <p className="text-center font-semibold text-foreground">Left (OS)</p>
      <p className="text-center font-semibold text-foreground">Right (OD)</p>
      {EYE_READING_ROWS.map((row) => (
        <Fragment key={row.key}>
          <p className="text-muted-foreground">
            {row.label}
            {"optional" in row && <span className="block text-xs">(if they have glasses)</span>}
          </p>
          {(["left", "right"] as const).map((eye) => {
            const field: EyeReadingField = `${eye}_${row.key}`;
            return (
              <SnellenInput
                key={field}
                aria-label={`${eye === "left" ? "Left (OS)" : "Right (OD)"}, ${row.label.toLowerCase()}`}
                value={values[field]}
                onChange={(value) => onChange(field, value)}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
