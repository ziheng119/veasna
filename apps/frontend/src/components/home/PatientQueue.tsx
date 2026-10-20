"use client"

import { Badge } from "../ui/badge";
import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { SearchIcon } from "@/assets/icons";
import { X } from "lucide-react";
import { stationLabel } from "@/constants/stations";
import { QueuedPatient } from "@/lib/types/patient";
import { PageCard } from "../shared/PageCard";

import QueueSortControl from "../shared/QueueSortControl";
import { useQueueSort } from "@/hooks/useQueueSort";
import { sortQueuePatients } from "@/lib/queueSort";

interface Props {
  patients: QueuedPatient[];
  onRemovePatient?: (visitId: number) => void;
}

export function PatientQueue({ patients, onRemovePatient }: Props) {
  const { mode, setMode } = useQueueSort("home");
  const [searchQuery, setSearchQuery] = useState("");  

  const filteredPatients = patients.filter((patient) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    const engName = patient.english_name?.toLowerCase() || "";
    const khmerName = patient.khmer_name?.toLowerCase() || "";
    const queueNo = patient.queue_no ? patient.queue_no.toString().toLowerCase() : "";

    return (
      engName.includes(query) ||
      khmerName.includes(query) ||
      queueNo.includes(query)
    );
  });

  const sortedPatients = sortQueuePatients(filteredPatients, mode);
  const today = new Date().toLocaleDateString();

  return (
    <PageCard
      title="Today's Queue"
      action={<Badge variant="inactive">{today}</Badge>}
      className="h-full flex flex-col"
      contentClassName="flex-1 overflow-y-auto space-y-3 bg-card"
      headerExtra={
        <div className="mt-4 space-y-3">
          <QueueSortControl mode={mode} onChange={setMode} />
          <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name or queue number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-input text-foreground placeholder-muted-foreground"
          />
          </div>
        </div>
      }
    >
        {sortedPatients.length === 0 ? (
          <p className="text-muted-foreground text-center">
            {searchQuery ? "No patients found matching search" : "No patients in queue today"}
          </p>
        ) : (
          sortedPatients.map((patient) => (
            <div
              key={patient.visit_id}
              className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors bg-card gap-3"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Badge variant="active" className="font-mono min-w-12 justify-center">
                  {patient.queue_no}
                </Badge>
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{patient.english_name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {patient.khmer_name}
                  </div>
                  {patient.current_station && (
                    <div className={`text-xs font-medium truncate ${patient.current_station === "tb" ? "text-destructive" : "text-primary"}`}>
                      At {stationLabel(patient.current_station)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right text-sm text-muted-foreground">
                  <div>{patient.age}y, {patient.sex}</div>
                  <div>{patient.timestamp}</div>
                </div>
                {onRemovePatient && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    title="Discharge patient"
                    onClick={() => {
                      if (!window.confirm(`Discharge ${patient.english_name || 'this patient'}?`)) {
                        return;
                      }
                      onRemovePatient(patient.visit_id);
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
    </PageCard>
  );
}