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
  // Stations that must stay ticked (the TB tent until a TB doctor clears the patient).
  held?: StationId[];
  // Stations not offered here.
  exclude?: StationId[];
}

export function StationCheckboxes({ idPrefix, selected, onChange, locked = [], held = [], exclude = [] }: StationCheckboxesProps) {
  const shown = STATIONS.filter((station) => !exclude.includes(station.id));
  const toggle = (id: StationId, checked: boolean) => {
    // Keep station order regardless of the order boxes are ticked in
    onChange(
      STATIONS.map((station) => station.id).filter((stationId) =>
        stationId === id ? checked : selected.includes(stationId)
      )
    );
  };

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3">
      {shown.map((station) => {
        const isHeld = held.includes(station.id);
        const isLocked = locked.includes(station.id) || isHeld;
        return (
          <div key={station.id} className="flex items-center space-x-2">
            <Checkbox
              id={`${idPrefix}-${station.id}`}
              checked={isLocked || selected.includes(station.id)}
              disabled={isLocked}
              onCheckedChange={(checked) => toggle(station.id, checked === true)}
              className="border-border bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label htmlFor={`${idPrefix}-${station.id}`} className="text-muted-foreground">
              {station.label}
              {isHeld ? " (until cleared)" : isLocked ? " (done)" : ""}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
