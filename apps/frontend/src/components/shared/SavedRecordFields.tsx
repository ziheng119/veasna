"use client";
import { ReactNode } from "react";

/** Native controls stay readable but cannot mutate an already-saved record. */
export default function SavedRecordFields({
  locked,
  children,
}: {
  locked: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {locked && (
        <p className="mb-3 text-sm text-muted-foreground">
          Read-only. Only an admin can change saved data.
        </p>
      )}
      <fieldset
        disabled={locked}
        className="min-w-0 space-y-4"
        onClickCapture={(event) => {
          // Covers custom chart controls as well as native form controls.
          if (locked) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </fieldset>
    </>
  );
}
