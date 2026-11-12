"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageCard } from "@/components/shared/PageCard";
import { SearchIcon } from "@/assets/icons/SearchIcon";
import { QueuedPatient } from "@/lib/types/patient";
import { getQueue, CLINIC_TODAY } from "@/lib/api/queue/getQueue";
import { completeQueueVisit } from "@/lib/api/queue/completeQueueVisit";
import { completeStation } from "@/lib/api/queue/stations";
import { StationId, stationLabel, stationPageHref } from "@/constants/stations";
import TbBadge, { tbCardClass } from "./TbBadge";
import FamilyBadge from "./FamilyBadge";
import StickerTag, { findSticker, stickerLabel, useStickerColours } from "./StickerTag";
import { stationMoveMessage } from "@/lib/family";
import { ENTER_FAST, LIFT } from "@/lib/motion";
import ClearTbButton from "./ClearTbButton";
import DisabledActionHint from "./DisabledActionHint";
import { TB_ROUTE_LOCKED_HINT } from "@/constants/tb";
import EditStationsDialog from "./EditStationsDialog";
import { useUserStore } from "@/stores/useUserStore";
import { canEditSavedData } from "@/lib/permissions";
import { Check, ChevronRight, CircleCheck, History, Hourglass, ListChecks, X } from "lucide-react";
import { useStationFlow } from "./StationFlow";
import toast from "react-hot-toast";
import { useLiveList } from "@/hooks/useLiveList";
import { useConfirm } from "@/hooks/useConfirm";

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
  const { confirm, dialog } = useConfirm();
  const { mode, setMode } = useQueueSort(station);
  const token = useUserStore((state) => state.user?.token);
  // Next, Send to and Discharge move patients: "Edit today's queue". Without it they are not shown.
  const canMove = useUserStore((state) => canEditSavedData(state.user));
  // Present on station pages (not Registration): Next saves the open form first, and the order is shared.
  const flow = useStationFlow();

  const [searchQuery, setSearchQuery] = useState("");
  const stickerColours = useStickerColours();
  const [editingPatient, setEditingPatient] = useState<QueuedPatient | null>(null);

  const load = useCallback(async (signal: AbortSignal): Promise<QueuedPatient[]> => {
    if (!token) return [];
    return getQueue(CLINIC_TODAY, token, station, signal);
  }, [token, station]);
  const { data: patients, refresh: loadQueue, loaded } = useLiveList(load);

  // Opening this page with ?visit=<id> (e.g. from the queue search) selects that visit once this
  // station's queue has loaded. The parameter is then removed so a reload does not reselect it.
  const router = useRouter();
  const pathname = usePathname();
  const requestedVisitId = Number(useSearchParams().get("visit")) || null;
  useEffect(() => {
    if (!requestedVisitId || !loaded || !token) return;
    const requested = patients.find((patient) => patient.visit_id === requestedVisitId);
    if (requested) onSelectPatient(requested);
    else toast(`That patient is no longer waiting at ${stationLabel(station)}.`);
    router.replace(pathname, { scroll: false });
  }, [requestedVisitId, loaded, token, patients, onSelectPatient, router, pathname, station]);

  // Bring the selected patient into view however they were chosen (queue search, link, click).
  useEffect(() => {
    if (!selectedVisitId || typeof document === "undefined") return;
    document.querySelector(`[data-visit-id="${selectedVisitId}"]`)
      ?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [selectedVisitId]);

  useEffect(() => {
    if (refreshKey !== undefined) void loadQueue();
  }, [loadQueue, refreshKey]);

  // The open patient leaving this queue without this device moving them on (another device sent them
  // on, finished or discharged them): StationFlow saves what was typed for them, closes their forms
  // and says where they went. Moves made here are remembered so they never count.
  const ownMoves = useRef(new Set<number>());
  const seen = useRef<{ key: string; patients: Map<number, QueuedPatient> } | null>(null);
  const openVisit = useRef(selectedVisitId);
  openVisit.current = selectedVisitId;
  const listKey = station;
  useEffect(() => {
    if (!loaded) return;
    const previous = seen.current;
    const now = new Map(patients.map((patient) => [patient.visit_id, patient]));
    seen.current = { key: listKey, patients: now };
    if (!flow || !selectedVisitId || previous?.key !== listKey || now.has(selectedVisitId)) return;
    const left = previous.patients.get(selectedVisitId);
    if (!left || ownMoves.current.has(selectedVisitId)) return;
    void flow.patientLeft(left, () => openVisit.current === left.visit_id);
  }, [loaded, patients, listKey, flow, selectedVisitId]);
  // Opening a patient replaces the note about the one who left.
  const clearDeparture = flow?.clearDeparture;
  useEffect(() => {
    if (selectedVisitId) clearDeparture?.();
  }, [selectedVisitId, clearDeparture]);

  // Station after this one for the patient, or null when this is their last.
  const nextStation = (patient: QueuedPatient): StationId | null => {
    const pending = (patient.stations ?? []).filter((s) => !s.completed).map((s) => s.station);
    return pending[pending.indexOf(station) + 1] ?? null;
  };

  const handleCompleteStation = async (patient: QueuedPatient) => {
    if (!token) return;

    try {
      // Saves anything typed into this patient's open form first; a failed save keeps them here.
      if (flow && !(await flow.saveDrafts(patient.visit_id))) return;
      ownMoves.current.add(patient.visit_id);
      const move = await completeStation(patient.visit_id, station, token);
      move.family_moved.forEach((member) => ownMoves.current.add(member.visit_id));
      const left = [patient.visit_id, ...move.family_moved.map((member) => member.visit_id)];
      // A patient waiting for family is still here, so stays selected.
      if (selectedVisitId && !move.held && left.includes(selectedVisitId)) {
        onSelectPatient(null);
      }
      toast.success(stationMoveMessage(patient.english_name || "Patient", move));
    } catch (err) {
      console.error("Failed to complete station:", err);
      toast.error(err instanceof Error ? err.message : "Failed to complete station");
    } finally {
      await loadQueue();
    }
  };

  const handleRemovePatient = async (patient: QueuedPatient) => {
    if (!token) return;
    if (!await confirm({
      title: `Discharge ${patient.english_name || "this patient"}?`,
      description: "They leave today's queue at every station. Their saved records stay.",
      confirmLabel: "Discharge",
    })) return;

    try {
      ownMoves.current.add(patient.visit_id);
      await completeQueueVisit(patient.visit_id, token);
      if (selectedVisitId === patient.visit_id) {
        onSelectPatient(null);
      }
      await loadQueue();
    } catch (err) {
      console.error("Failed to remove patient from queue:", err);
      toast.error(err instanceof Error ? err.message : "Failed to remove patient from queue");
    }
  };

  // A returning patient's earlier visits, on Patient Details. Anything typed into their open form is
  // saved first, as with Next; Back there returns to this queue with the patient selected again.
  const openPastVisits = async (patient: QueuedPatient) => {
    if (flow && !(await flow.saveDrafts(patient.visit_id))) return;
    const from = stationPageHref(station, patient.visit_id);
    router.push(`/patient-details?id=${patient.patient_id}&from=${encodeURIComponent(from)}`);
  };

  // A cleared patient who is still waiting here stays selected, without the red marker.
  const handleTbCleared = async (patient: QueuedPatient, currentStation: StationId | null) => {
    if (selectedVisitId === patient.visit_id) {
      onSelectPatient(currentStation === station ? { ...patient, tb_flagged: false, tb_status: "cleared" } : null);
    }
    await loadQueue();
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

  // "Save & next" on this page opens the next patient in the order shown here.
  useEffect(() => {
    flow?.registerQueue(sortedPatients, loadQueue);
  }, [flow, sortedPatients, loadQueue]);

  return (
    <PageCard
      title={`${stationLabel(station)} Queue`}
      tour="station-queue"
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
          const tbFlagged = !!patient.tb_flagged;
          // Flagged now or cleared: a TB patient only goes to Consult (the server refuses route edits).
          const routeLocked = patient.tb_status != null;
          const sticker = findSticker(stickerColours, patient.sticker_colour);
          return (
            <div
              key={`${patient.visit_id}-${patient.queue_no}`}
              data-visit-id={patient.visit_id}
              onClick={(event) => {
                // The native buttons handle their own actions; all remaining card space selects.
                if (!(event.target as Element).closest("button")) onSelectPatient(patient);
              }}
              className={`cursor-pointer rounded-lg border p-3 ${LIFT} ${ENTER_FAST} ${
                tbFlagged
                  ? tbCardClass(isSelected)
                  : isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent/60"
              }`}
            >
              <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`Select ${patient.english_name || "patient"}, queue ${patient.queue_no}${stickerLabel(sticker)}${tbFlagged ? ", suspected TB" : ""}`}
                aria-pressed={isSelected}
                onClick={() => onSelectPatient(patient)}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
              >
                {/* Queue number first and large: it is what staff call out. */}
                <span className="flex shrink-0 flex-col items-center gap-1">
                  <span className="relative flex">
                    <span
                      data-queue-no
                      className={`min-w-[3.25rem] rounded-md px-2 py-1 text-center text-2xl font-bold leading-none tabular-nums ${
                        tbFlagged
                          ? "bg-red-600 text-white"
                          : isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      {patient.queue_no}
                    </span>
                    <StickerTag sticker={sticker} pinned />
                  </span>
                  {tbFlagged && <TbBadge />}
                  {patient.family && <FamilyBadge family={patient.family} />}
                </span>
                <span className="min-w-0 flex-1 border-l border-border pl-3">
                  <span className="block break-words font-medium text-foreground">{patient.english_name || "Unknown name"}</span>
                  {patient.khmer_name?.trim() && <span className="block break-words text-sm text-muted-foreground">{patient.khmer_name}</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">{patient.station_arrival_time ? `Arrived ${patient.station_arrival_time}` : `Registered ${patient.timestamp}`}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {next ? `Next: ${stationLabel(next)}` : "Last station"}
                  </span>
                  {patient.family_waiting ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                      <Hourglass className="size-3.5" aria-hidden="true" /> Waiting for family
                    </span>
                  ) : patient.station_done && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <CircleCheck className="size-3.5" aria-hidden="true" /> Done here
                    </span>
                  )}
                </span>
              </button>
              <div className="flex shrink-0 items-center">
                {/* TB is cleared only at Consult, by the doctor who saw the patient. */}
                {tbFlagged && station === "consultation" && (
                  <ClearTbButton
                    patient={patient}
                    onCleared={(currentStation) => handleTbCleared(patient, currentStation)}
                    className="h-auto w-14 shrink-0 flex-col gap-0.5 px-0 py-0.5 text-[10px] leading-none font-normal"
                  />
                )}
                {canMove && <>
                <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-14 shrink-0 flex-col gap-0.5 px-0 py-0.5 text-[10px] leading-none font-normal text-muted-foreground hover:text-primary"
                    title={next ? `Done here, move to ${stationLabel(next)}` : "Done here, finish visit"}
                    onClick={() => handleCompleteStation(patient)}
                  >
                    <Check className="size-3.5" />
                    {next ? "Next" : "Finish"}
                  </Button>
                <DisabledActionHint disabled={routeLocked} message={TB_ROUTE_LOCKED_HINT}>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={routeLocked}
                    className="h-auto w-14 shrink-0 flex-col gap-0.5 px-0 py-0.5 text-[10px] leading-none font-normal text-muted-foreground hover:text-foreground"
                    title={routeLocked ? undefined : "Send to station…: choose which stations this patient goes to next, and in what order"}
                    aria-label={`Send ${patient.english_name || "patient"} to another station`}
                    onClick={() => setEditingPatient(patient)}
                  >
                    <ListChecks className="size-3.5" />
                    Send to
                  </Button>
                </DisabledActionHint>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-14 shrink-0 flex-col gap-0.5 px-0 py-0.5 text-[10px] leading-none font-normal text-muted-foreground hover:text-destructive"
                  title="Discharge patient from every queue"
                  onClick={() => handleRemovePatient(patient)}
                >
                  <X className="size-3.5" />
                  Discharge
                </Button>
                </>}
              </div>
              </div>
              {/* Only for a patient who has been before: their earlier trips and days. */}
              {!!patient.previous_visits && (
                <div className="mt-2 border-t border-border/70 pt-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="group/past h-7 gap-1.5 rounded-full px-2 text-xs font-medium text-muted-foreground hover:text-primary"
                    aria-label={`Past visits of ${patient.english_name || "patient"}: ${patient.previous_visits}`}
                    onClick={() => void openPastVisits(patient)}
                  >
                    <History className="size-3.5" aria-hidden="true" />
                    Past visits ({patient.previous_visits})
                    <ChevronRight className="size-3.5 transition-transform duration-200 group-hover/past:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          );
        })
      )}
      <EditStationsDialog
        patient={editingPatient}
        onClose={() => setEditingPatient(null)}
        onSaved={() => {
          // A new route can take the patient off this queue: that move was made here.
          if (editingPatient) ownMoves.current.add(editingPatient.visit_id);
          return loadQueue();
        }}
      />
      {dialog}
    </PageCard>
  );
}
