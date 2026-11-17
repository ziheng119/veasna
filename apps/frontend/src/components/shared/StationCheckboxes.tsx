"use client";

import { STATIONS, StationId } from "@/constants/stations";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";

interface StationCheckboxesProps {
  idPrefix: string;
  selected: StationId[];
  onChange: (stations: StationId[]) => void;
  // Stations that can no longer be changed (already completed for the visit).
  locked?: StationId[];
  // Stations offered, in clinic order. Defaults to every station.
  options?: StationId[];
}

export function StationCheckboxes({ idPrefix, selected, onChange, locked = [], options }: StationCheckboxesProps) {
  const shown = STATIONS.filter((station) => !options || options.includes(station.id));
  const toggle = (id: StationId, checked: boolean) => {
    // Keep station order regardless of the order boxes are ticked in
    onChange(
      shown.map((station) => station.id).filter((stationId) =>
        stationId === id ? checked : selected.includes(stationId)
      )
    );
  };

  return (
    <div className="flex flex-wrap gap-x-6">
      {shown.map((station) => {
        const isLocked = locked.includes(station.id);
        return (
          // Each row is at least 40px tall, the label filling it, so it is easy to tap on a tablet.
          <div key={station.id} className="flex min-h-10 items-center space-x-2">
            <Checkbox
              id={`${idPrefix}-${station.id}`}
              checked={isLocked || selected.includes(station.id)}
              disabled={isLocked}
              onCheckedChange={(checked) => toggle(station.id, checked === true)}
              className="bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label htmlFor={`${idPrefix}-${station.id}`} className="self-stretch cursor-pointer pr-2 font-normal">
              {station.label}
              {isLocked ? " (done)" : ""}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
