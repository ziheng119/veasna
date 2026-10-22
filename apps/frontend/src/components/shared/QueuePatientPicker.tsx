"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageCard } from "@/components/shared/PageCard";
import { SearchIcon } from "@/assets/icons/SearchIcon";
import { QueuedPatient } from "@/lib/types/patient";
import { getQueue } from "@/lib/api/queue/getQueue";
import { completeQueueVisit } from "@/lib/api/queue/completeQueueVisit";
import { completeStation } from "@/lib/api/queue/stations";
import { StationId, stationLabel } from "@/constants/stations";
import { TB_STATUS_LABELS } from "@/constants/tb";
import EditStationsDialog from "./EditStationsDialog";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserStore } from "@/stores/useUserStore";
import { Check, ListChecks, X } from "lucide-react";
import toast from "react-hot-toast";
import { useLiveList } from "@/hooks/useLiveList";

import QueueSortControl from "./QueueSortControl";
import { useQueueSort } from "@/hooks/useQueueSort";
import { sortQueuePatients } from "@/lib/queueSort";

interface QueuePatientPickerProps {
  // The queue shown is only the patients currently waiting at this station.
  station: StationId;
  onSelectPatient: (patient: QueuedPatient | null) => void;
  selectedVisitId?: number;
  // Change this value to make the queue reload (e.g. after another panel edits a visit's stations).
  refreshKey?: number;
}

export default function QueuePatientPicker({
  station,
  onSelectPatient,
  selectedVisitId,
  refreshKey,
}: QueuePatientPickerProps) {
  const isAdmin = useUserStore(state => state.user?.role === "admin");
  const { mode, setMode } = useQueueSort(station);
  const location = useLocationStore((state) => state.currentLocation);
  const token = useUserStore((state) => state.user?.token);

  const [searchQuery, setSearchQuery] = useState("");
  const [editingPatient, setEditingPatient] = useState<QueuedPatient | null>(null);

  const locationId = location?.id;
  const load = useCallback(async (signal: AbortSignal): Promise<QueuedPatient[]> => {
    if (!locationId || !token) return [];
    return getQueue(locationId, new Date().toISOString().slice(0, 10), token, station, signal);
  }, [locationId, token, station]);
  const { data: patients, refresh: loadQueue } = useLiveList(load);

  useEffect(() => {
    if (refreshKey !== undefined) void loadQueue();
  }, [loadQueue, refreshKey]);

  // Station after this one for the patient, or null when this is their last.
  const nextStation = (patient: QueuedPatient): StationId | null => {
    const pending = (patient.stations ?? []).filter((s) => !s.completed).map((s) => s.station);
    return pending[pending.indexOf(station) + 1] ?? null;
  };

  const handleCompleteStation = async (patient: QueuedPatient) => {
    if (!token) return;

    try {
      const next = await completeStation(patient.visit_id, station, token);
      if (selectedVisitId === patient.visit_id) {
        onSelectPatient(null);
      }
      toast.success(
        next
          ? `${patient.english_name || "Patient"} moved to ${stationLabel(next)}.`
          : `${patient.english_name || "Patient"} has finished all stations.`
      );
    } catch (err) {
      console.error("Failed to complete station:", err);
      toast.error(err instanceof Error ? err.message : "Failed to complete station");
    } finally {
      await loadQueue();
    }
  };

  const handleRemovePatient = async (patient: QueuedPatient) => {
    if (!token) return;
    if (!window.confirm(`Discharge ${patient.english_name || "this patient"}?`)) {
      return;
    }

    try {
      await completeQueueVisit(patient.visit_id, token);
      if (selectedVisitId === patient.visit_id) {
        onSelectPatient(null);
      }
      await loadQueue();
    } catch (err) {
      console.error("Failed to remove patient from queue:", err);
      toast.error("Failed to remove patient from queue");
    }
  };

  const sortedPatients = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = patients.filter((patient) => {
      if (!query) return true;
      const engName = patient.english_name?.toLowerCase() || "";
      const khmerName = patient.khmer_name?.toLowerCase() || "";
      const queueNo = patient.queue_no?.toLowerCase() || "";
      return (
        engName.includes(query) ||
        khmerName.includes(query) ||
        queueNo.includes(query)
      );
    });
    return sortQueuePatients(filtered, mode);
  }, [patients, searchQuery, mode]);

  return (
    <PageCard
      title={`${stationLabel(station)} Queue`}
      action={<Badge variant="inactive">{patients.length} waiting</Badge>}
      className="xl:col-span-4"
      contentClassName="space-y-3"
      headerExtra={
        <div className="mt-4 space-y-3">
          <QueueSortControl mode={mode} onChange={setMode} />
          <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by queue or name"
            className="pl-10"
          />
          </div>
        </div>
      }
    >
      {sortedPatients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {searchQuery ? "No patients match this search." : `No patients waiting at ${stationLabel(station)}.`}
        </p>
      ) : (
        sortedPatients.map((patient) => {
          const isSelected = selectedVisitId === patient.visit_id;
          const next = nextStation(patient);
          return (
            <div
              key={`${patient.visit_id}-${patient.queue_no}`}
              onClick={(event) => {
                // The native buttons handle their own actions; all remaining card space selects.
                if (!(event.target as Element).closest("button")) onSelectPatient(patient);
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent/60"
              }`}
            >
              <button
                type="button"
                aria-label={`Select ${patient.english_name || "patient"}, queue ${patient.queue_no}`}
                aria-pressed={isSelected}
                onClick={() => onSelectPatient(patient)}
                className="min-w-0 flex-1 text-left"
              >
                <Badge variant={isSelected ? "active" : "inactive"}>{patient.queue_no}</Badge>
                <p className="mt-2 font-medium text-foreground">{patient.english_name || "Unknown name"}</p>
                {patient.khmer_name?.trim() && <p className="text-sm text-muted-foreground">{patient.khmer_name}</p>}
                <span className="mt-1 block text-xs text-muted-foreground">{patient.station_arrival_time ? `Arrived ${patient.station_arrival_time}` : `Registered ${patient.timestamp}`}</span>
                {station === "tb" && patient.tb_status ? (
                  <p className={`mt-1 text-xs font-medium ${patient.tb_status === "tb_likely" ? "text-destructive" : "text-muted-foreground"}`}>
                    {TB_STATUS_LABELS[patient.tb_status]}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {next ? `Next: ${stationLabel(next)}` : "Last station"}
                  </p>
                )}
              </button>
              <div className="flex shrink-0 items-center">
                {/* Leaving the TB tent needs the TB doctor's decision, made in the panel */}
                {station !== "tb" && (
                  <Button
                    disabled={!isAdmin}                     type="button"
                    variant="ghost"
                    className="h-auto w-14 shrink-0 flex-col gap-0.5 px-0 py-0.5 text-[10px] leading-none font-normal text-muted-foreground hover:text-primary"
                    title={next ? `Done here, move to ${stationLabel(next)}` : "Done here, finish visit"}
                    onClick={() => handleCompleteStation(patient)}
                  >
                    <Check className="size-3.5" />
                    {next ? "Next" : "Finish"}
                  </Button>
                )}
                <Button
                    disabled={!isAdmin}                   type="button"
                  variant="ghost"
                  className="h-auto w-14 shrink-0 flex-col gap-0.5 px-0 py-0.5 text-[10px] leading-none font-normal text-muted-foreground hover:text-foreground"
                  title="Change which stations this patient still has to visit"
                  onClick={() => setEditingPatient(patient)}
                >
                  <ListChecks className="size-3.5" />
                  Stations
                </Button>
                <Button
                    disabled={!isAdmin}                   type="button"
                  variant="ghost"
                  className="h-auto w-14 shrink-0 flex-col gap-0.5 px-0 py-0.5 text-[10px] leading-none font-normal text-muted-foreground hover:text-destructive"
                  title="Discharge patient from every queue"
                  onClick={() => handleRemovePatient(patient)}
                >
                  <X className="size-3.5" />
                  Discharge
                </Button>
              </div>
            </div>
          );
        })
      )}
      <EditStationsDialog
        patient={editingPatient}
        onClose={() => setEditingPatient(null)}
        onSaved={loadQueue}
      />
    </PageCard>
  );
}
