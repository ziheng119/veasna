"use client"

import PatientHeader from "@/components/shared/PatientHeader";
import RegistrationSummary from "@/components/shared/RegistrationSummary";
import { QueuedPatient } from "@/lib/types/patient";
import { useEffect, useRef, useState } from "react";
import NoPatientSelected from "@/components/shared/NoPatientSelected";
import { TriageTabs } from "@/components/triage/TriageTabs";
import TbFlagPanel from "@/components/triage/TbFlagPanel";
import QueuePatientPicker from "@/components/shared/QueuePatientPicker";
import { PAGE_SHELL, PANEL_GRID } from "@/lib/pageLayout";
import { cn } from "@/lib/utils";
import { StationId } from "@/constants/stations";
import { StationFlowProvider } from "@/components/shared/StationFlow";
import StationDataButton from "@/components/shared/StationDataButton";

// Below this width the queue sits above the open patient (see the grid below).
const STACKED = "(max-width: 1023.98px)";

export default function Triage() {

  const [selectedPatient, setSelectedPatient] = useState<QueuedPatient | null>(null);
  const [queueVersion, setQueueVersion] = useState(0);

  // The open patient's column scrolls as one: the patient bar stays at the top, the vitals and TB
  // line scroll away, the section tabs stick under the bar and each section's buttons at the bottom.
  // The bar's height is kept in --triage-header so the tabs stick just below it.
  const workRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const visitId = selectedPatient?.visit_id;
  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeaderHeight(header.offsetHeight));
    observer.observe(header);
    return () => observer.disconnect();
  }, [visitId]);
  // Opening a patient starts at the top of their record. On a narrow screen, where their record is
  // below the queue, it is also scrolled into view, so tapping a card visibly opens them.
  useEffect(() => {
    const work = workRef.current;
    if (!visitId || !work) return;
    work.scrollTop = 0;
    if (typeof window !== "undefined" && window.matchMedia?.(STACKED).matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      work.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  }, [visitId]);

  // Triage changed which stations the selected patient still has to visit.
  const handleStationsChanged = (remaining: StationId[]) => {
    setSelectedPatient((prev) => prev && {
      ...prev,
      stations: [
        ...(prev.stations ?? []).filter((s) => s.completed),
        ...remaining.map((station) => ({ station, completed: false })),
      ],
    });
    setQueueVersion((version) => version + 1);
  };

  // Triage flagged suspected TB. That sends the patient to Consult, so they leave this queue;
  // otherwise only the red TB marker changes.
  const handleTbFlagged = (currentStation: StationId | null) => {
    setSelectedPatient((prev) => prev && (currentStation && currentStation !== "triage" ? null : { ...prev, tb_flagged: true }));
    setQueueVersion((version) => version + 1);
  };



    return (
      <StationFlowProvider station="triage" onSelectPatient={setSelectedPatient}>
        <div className={cn(PAGE_SHELL, "lg:h-full lg:min-h-[480px]")}>
          <div className="flex items-center justify-end gap-3">
            <StationDataButton station="triage" />
          </div>
          {/* One surface split by a line: the queue (tinted) on the left, the open patient on the right.
              Side by side from 1024px (tablets in landscape), each scrolling on its own, not only from xl like other stations.
              overflow-clip, not hidden, so the sticky patient bar and buttons still stick when the
              page itself scrolls (below lg). */}
          <div className={cn(PANEL_GRID, "gap-0 overflow-clip rounded-xl border border-border bg-card shadow-sm lg:h-full lg:min-h-0 lg:flex-1 lg:grid-rows-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
            <QueuePatientPicker
              embedded
              autoFold={false}
              station="triage"
              onSelectPatient={setSelectedPatient}
              selectedVisitId={selectedPatient?.visit_id}
              refreshKey={queueVersion}
            />
            <div
              ref={workRef}
              data-tour="station-work"
              className="flex min-w-0 scroll-mt-4 flex-col xl:col-span-8 lg:min-h-0 lg:overflow-y-auto lg:[scrollbar-gutter:stable]"
              style={{ "--triage-header": `${headerHeight}px` } as React.CSSProperties}
            >
              {!selectedPatient ? (
                <NoPatientSelected embedded />
              ) : (
                <>
                  <div ref={headerRef} className="sticky top-0 z-20 border-b border-border bg-card px-5 py-3">
                    <PatientHeader patient={selectedPatient} />
                  </div>
                  <TriageTabs patient={selectedPatient} patient_id={selectedPatient.patient_id!}
                    key={selectedPatient.visit_id}
                    visit_id={selectedPatient.visit_id}
                    stations={selectedPatient.stations}
                    onStationsChanged={handleStationsChanged}
                    context={<>
                      <RegistrationSummary patient={selectedPatient} />
                      <TbFlagPanel visitId={selectedPatient.visit_id} onFlagged={handleTbFlagged} />
                    </>}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </StationFlowProvider>
    )
}