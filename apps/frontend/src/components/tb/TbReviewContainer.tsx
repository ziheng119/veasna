"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { PageCard } from "@/components/shared/PageCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { stationLabel } from "@/constants/stations";
import { TB_STATUS_LABELS, tbRedFlagLabel } from "@/constants/tb";
import { getTbScreening, reviewTb, TbDecision, TbScreening } from "@/lib/api/tb/tb";
import { QueuedPatient } from "@/lib/types/patient";
import { useUserStore } from "@/stores/useUserStore";

interface TbReviewContainerProps {
  patient: QueuedPatient;
  // Called after the decision is saved. "cleared" means the patient has left the TB tent.
  onDecided: (decision: TbDecision) => void;
}

// TB doctor's review: the red flags from registration and the decision that releases the patient.
export default function TbReviewContainer({ patient, onDecided }: TbReviewContainerProps) {
  const token = useUserStore((state) => state.user?.token);
  const [screening, setScreening] = useState<TbScreening | null>(null);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    getTbScreening(patient.visit_id, token)
      .then((data) => {
        if (cancelled) return;
        setScreening(data);
        setDoctorNotes(data?.doctor_notes ?? "");
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load TB screening");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patient.visit_id, token]);

  const onwardStations = (patient.stations ?? [])
    .filter((s) => !s.completed && s.station !== "tb")
    .map((s) => stationLabel(s.station));

  const handleDecision = async (decision: TbDecision) => {
    if (!token) return;
    const name = patient.english_name || "this patient";
    const question =
      decision === "cleared"
        ? `Confirm ${name} has no TB? ${
            onwardStations.length > 0
              ? `They will be sent to ${onwardStations[0]}.`
              : "They have no other stations, so their visit will finish."
          }`
        : `Record that TB is not ruled out for ${name}? They will stay in the TB tent.`;
    if (!window.confirm(question)) return;

    try {
      setIsSaving(true);
      const result = await reviewTb(patient.visit_id, decision, doctorNotes, token);
      if (decision === "cleared") {
        toast.success(
          result.next_station
            ? `${name} cleared and moved to ${stationLabel(result.next_station)}.`
            : `${name} cleared. Their visit is finished.`
        );
      } else {
        toast.success(`${name} stays in the TB tent. Discharge them when they leave.`);
        setScreening((prev) => prev && { ...prev, status: decision, doctor_notes: doctorNotes });
      }
      onDecided(decision);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save TB decision");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageCard
      title="TB Screening"
      action={screening && (
        <Badge variant={screening.status === "tb_likely" ? "destructive" : "warning"}>
          {screening.status === "tb_likely" ? "TB not ruled out" : "Suspected TB"}
        </Badge>
      )}
      className="xl:col-span-8"
      contentClassName="space-y-5"
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading TB screening...</p>
      ) : (
        <>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-foreground">Red flags noted at registration</h4>
            {screening && screening.red_flags.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {screening.red_flags.map((flag) => (
                  <li key={flag}>{tbRedFlagLabel(flag)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No red flags were ticked; the patient was sent to the TB tent from a station.</p>
            )}
            {screening?.flag_notes && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                <span className="font-medium">Notes: </span>{screening.flag_notes}
              </p>
            )}
            {screening?.flagged_by && (
              <p className="mt-2 text-xs text-muted-foreground">
                Flagged by {screening.flagged_by} at {new Date(screening.flagged_at).toLocaleTimeString()}
              </p>
            )}
          </div>

          {screening && screening.status !== "suspected" && (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {TB_STATUS_LABELS[screening.status]}
              {screening.reviewed_by ? ` (recorded by ${screening.reviewed_by})` : ""}
            </p>
          )}

          <div>
            <Label htmlFor="tb-doctor-notes" className="mb-2 block text-muted-foreground">TB doctor&apos;s notes</Label>
            <Textarea
              id="tb-doctor-notes"
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              placeholder="Findings, advice, referral for TB testing or treatment"
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {onwardStations.length > 0
                ? `Once cleared, the patient goes to: ${onwardStations.join(" → ")}. Use Stations in the queue to change this.`
                : "The patient has no other stations; clearing them finishes their visit."}
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isSaving}
                onClick={() => handleDecision("tb_likely")}
              >
                TB not ruled out: keep isolated
              </Button>
              <Button type="button" disabled={isSaving} onClick={() => handleDecision("cleared")}>
                {isSaving ? "Please wait..." : "Cleared: no TB"}
              </Button>
            </div>
          </div>
        </>
      )}
    </PageCard>
  );
}
