"use client";

import { STATIONS, StationId, stationLabel } from "@/constants/stations";
import { Button } from "@/components/ui/button";

interface Props {
  route: StationId[];
  completed: StationId[];
  onChange: (route: StationId[]) => void;
  onTbHold: boolean;
  disabled?: boolean;
}

// This orders a single patient's stops, not the patients within a station queue.
export default function StationRouteEditor({ route, completed, onChange, onTbHold, disabled = false }: Props) {
  const move = (index: number, target: number) => {
    const next = [...route];
    const [station] = next.splice(index, 1);
    next.splice(target, 0, station);
    onChange(next);
  };
  const add = (station: StationId) => {
    if (station === "tb") onChange([station, ...route]);
    else if (completed.includes(station)) {
      // A revisit is the next stop, but it can never bypass a pending TB review.
      const index = route[0] === "tb" ? 1 : 0;
      onChange([...route.slice(0, index), station, ...route.slice(index)]);
    } else onChange([...route, station]);
  };

  return (
    <div className="space-y-4">
      <ol aria-label="Remaining station route" className="space-y-3">
        {route.map((station, index) => (
          <li key={station} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <span className="flex-1 text-sm">
              {index + 1}. {stationLabel(station)}{index === 0 ? " (next stop)" : ""}
              {completed.includes(station) ? " ? revisit" : ""}
            </span>
            <Button type="button" variant="outline" size="sm" aria-label={`Move ${stationLabel(station)} earlier`}
              disabled={disabled || index === 0 || route[index - 1] === "tb"}
              onClick={() => move(index, index - 1)}>Up</Button>
            <Button type="button" variant="outline" size="sm" aria-label={`Move ${stationLabel(station)} later`}
              disabled={disabled || station === "tb" || index === route.length - 1}
              onClick={() => move(index, index + 1)}>Down</Button>
            <Button type="button" variant="outline" size="sm" aria-label={`Defer ${stationLabel(station)}`}
              disabled={disabled || station === "tb" || index === route.length - 1}
              onClick={() => move(index, route.length - 1)}>Skip for now</Button>
            <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${stationLabel(station)}`}
              disabled={disabled || (station === "tb" && onTbHold)}
              onClick={() => onChange(route.filter(s => s !== station))}>Remove</Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2" aria-label="Add or revisit stations">
        {STATIONS.filter(s => !route.includes(s.id)).map(station => (
          <Button key={station.id} type="button" variant="outline" size="sm" disabled={disabled}
            onClick={() => add(station.id)}>
            {completed.includes(station.id) ? "Return to" : "Add"} {station.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
