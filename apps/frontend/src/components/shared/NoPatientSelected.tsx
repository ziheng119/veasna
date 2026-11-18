"use client";

import { StationDepartureNotice } from "./StationFlow";

// The empty panel beside a station queue. When the open patient was just moved on from another
// device, it says where they went.
// embedded: inside a page surface that already has its own edge (no dashed box).
export default function NoPatientSelected({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={`flex-1 min-h-[360px] flex flex-col items-center justify-center w-full text-muted-foreground ${
      embedded ? "" : "border-2 border-dashed border-border rounded-xl bg-card"}`}>
      <StationDepartureNotice className="mx-4 mb-6 max-w-md" />
      <h2 className="text-lg font-semibold mb-2 text-foreground">No one open yet</h2>
      <p className="max-w-xs text-center text-sm">
        Choose the next patient in the queue to open their forms.
      </p>
    </div>
  );
}
