"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { QueuedPatient } from "@/lib/types/patient";
import { StationId } from "@/constants/stations";
import { PAGE_SHELL, PANEL_GRID } from "@/lib/pageLayout";
import { cn } from "@/lib/utils";
import QueuePatientPicker from "./QueuePatientPicker";
import NoPatientSelected from "./NoPatientSelected";
import PatientHeader from "./PatientHeader";

// Below this width the queue sits above the open patient (see the grid below).
const STACKED = "(max-width: 1023.98px)";

interface Props {
  station: StationId;
  selectedPatient: QueuedPatient | null;
  onSelectPatient: (patient: QueuedPatient | null) => void;
  // Change to make the queue reload (e.g. after the form changed the patient's stations).
  refreshKey?: number;
  // Page-wide buttons (e.g. Print referrals), in a row above the surface, right-aligned.
  actions?: ReactNode;
  // The open patient's record and forms, under the sticky patient bar.
  children: (patient: QueuedPatient) => ReactNode;
}

/**
 * A station page as one surface split by a line: the queue (tinted) on the left and the open
 * patient on the right, side by side from 1024px (tablets in landscape), each scrolling on its own.
 * The patient's column scrolls as one under a sticky patient bar; its height is kept in
 * --patient-bar so tabs inside can stick just below it, and forms keep their buttons sticky at the
 * bottom. Below 1024px the queue sits above the patient, and opening one scrolls to them.
 */
export default function StationSurface({ station, selectedPatient, onSelectPatient, refreshKey, actions, children }: Props) {
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

  return (
    <div className={cn(PAGE_SHELL, "lg:h-full lg:min-h-[480px]")}>
      {actions && <div className="flex flex-wrap items-center justify-end gap-3">{actions}</div>}
      {/* overflow-clip, not hidden, so the sticky patient bar and buttons still stick when the page
          itself scrolls (below lg). */}
      <div className={cn(PANEL_GRID, "gap-0 overflow-clip rounded-xl border border-border bg-card shadow-sm lg:h-full lg:min-h-0 lg:flex-1 lg:grid-rows-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        <QueuePatientPicker
          embedded
          autoFold={false}
          station={station}
          onSelectPatient={onSelectPatient}
          selectedVisitId={visitId}
          refreshKey={refreshKey}
        />
        <div
          ref={workRef}
          data-tour="station-work"
          className="flex min-w-0 scroll-mt-4 flex-col xl:col-span-8 lg:min-h-0 lg:overflow-y-auto lg:[scrollbar-gutter:stable]"
          style={{ "--patient-bar": `${headerHeight}px` } as CSSProperties}
        >
          {!selectedPatient ? (
            <NoPatientSelected embedded />
          ) : (
            <>
              <div ref={headerRef} className="sticky top-0 z-20 border-b border-border bg-card px-5 py-3">
                <PatientHeader patient={selectedPatient} />
              </div>
              {children(selectedPatient)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
