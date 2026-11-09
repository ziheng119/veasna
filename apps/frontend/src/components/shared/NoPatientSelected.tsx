"use client";

import { StationDepartureNotice } from "./StationFlow";

// The empty panel beside a station queue. When the open patient was just moved on from another
// device, it says where they went.
export default function NoPatientSelected() {
  return (
    <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center w-full border-2 border-dashed border-border rounded-xl bg-card text-muted-foreground">
      <StationDepartureNotice className="mx-4 mb-6 max-w-md" />
      <h2 className="text-lg font-semibold mb-2 text-foreground">No Patient Selected</h2>
      <p className="text-center text-sm">
        Please select a patient from the list to view their details.
      </p>
    </div>
  );
}
