"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CornerDownLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchIcon } from "@/assets/icons/SearchIcon"
import { CrossIcon } from "@/assets/icons/CrossIcon"
import StationBadge from "./StationBadge"
import { QueuedPatient } from "@/lib/types/patient"
import { Location } from "@/lib/types/location"
import { StationId, stationLabel, stationPageHref } from "@/constants/stations"
import { useLocationStore } from "@/stores/useLocationStore"
import { useLiveList } from "@/hooks/useLiveList"
import { getQueue } from "@/lib/api/queue/getQueue"
import { sortQueuePatients } from "@/lib/queueSort"
import { useUserStore } from "@/stores/useUserStore"
import { cn } from "@/lib/utils"

// With nothing typed, the dropdown previews the next few patients by queue number.
const UPCOMING_COUNT = 6
const MAX_RESULTS = 8

interface SearchBarProps {
  // The station this page works. Patients waiting here open in place; others open on their
  // own station's page. Omit on pages that are not a station.
  station?: StationId
  onSelectPatient?: (patient: QueuedPatient) => void
}

function matches(patient: QueuedPatient, query: string) {
  return [patient.queue_no, patient.english_name, patient.khmer_name]
    .some((text) => text?.toLowerCase().includes(query))
}

/** Today's whole queue, searchable by queue number or name, showing where each patient is. */
export default function SearchBar({ station, onSelectPatient }: SearchBarProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [query, setQuery] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  // Opening another station's page can take a moment (e.g. on a slow laptop). Until it has
  // rendered, the dropdown stays open and the chosen row says where it is going.
  const [isNavigating, startNavigation] = useTransition()
  const [openingVisitId, setOpeningVisitId] = useState<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchId = useId()
  const listId = `${searchId}-list`
  const token = useUserStore((state) => state.user?.token)
  const location: Location | null = useLocationStore(state => state.currentLocation)

  const locationId = location?.id
  const load = useCallback(async (signal: AbortSignal): Promise<QueuedPatient[]> => {
    if (!locationId || !token) return []
    return getQueue(locationId, new Date().toISOString().slice(0, 10), token, undefined, signal)
  }, [locationId, token])
  const { data: patients } = useLiveList(load)

  const trimmed = query.trim().toLowerCase()
  const byNumber = useMemo(() => sortQueuePatients(patients, "number"), [patients])
  const results = useMemo(() => {
    if (!trimmed) return byNumber.slice(0, UPCOMING_COUNT)
    const found = byNumber.filter((patient) => matches(patient, trimmed))
    // An exact queue number is almost always the one wanted, so it goes first.
    const exact = found.findIndex((patient) => patient.queue_no.toLowerCase() === trimmed)
    if (exact > 0) found.unshift(...found.splice(exact, 1))
    return found.slice(0, MAX_RESULTS)
  }, [byNumber, trimmed])

  const open = expanded && (showSuggestions || isNavigating)

  // Clicking elsewhere hides the dropdown but keeps what was typed.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  // Collapsing only dismisses the lookup; it does not clear the selected patient.
  const closeSearch = () => {
    setExpanded(false)
    setQuery("")
    setShowSuggestions(false)
    setHighlightedIndex(0)
    triggerRef.current?.focus()
  }

  const handlePatientSelect = (patient: QueuedPatient) => {
    if (isNavigating) return
    const current = patient.current_station
    if (current && current === station && onSelectPatient) {
      closeSearch()
      onSelectPatient(patient)
      return
    }
    // Every station is done but the visit is still open: show the patient's record.
    const href = current ? stationPageHref(current, patient.visit_id) : `/patient-details?id=${patient.patient_id}`
    setOpeningVisitId(patient.visit_id)
    startNavigation(() => router.push(href))
  }
  const opening = isNavigating ? openingVisitId : null

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      if (!opening) closeSearch()
      return
    }
    if (results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setShowSuggestions(true)
      setHighlightedIndex(prev => (prev + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setShowSuggestions(true)
      setHighlightedIndex(prev => (prev - 1 + results.length) % results.length)
    } else if (e.key === "Enter" && open) {
      e.preventDefault()
      handlePatientSelect(results[Math.min(highlightedIndex, results.length - 1)])
    }
  }

  const emptyMessage = !locationId
    ? "Select a location to search its queue."
    : trimmed
      ? `No patient in today's queue matches "${query.trim()}".`
      : "No patients in today's queue yet."

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl text-foreground">
      {/* Keep one border and icon mounted so the circle expands into the field. */}
      <div
        className={cn(
          "flex h-10 items-center overflow-hidden rounded-full border bg-card transition-[width,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none",
          open ? "border-primary/40 shadow-md ring-2 ring-primary/10" : "border-border",
        )}
        style={{ width: expanded ? "100%" : "2.5rem" }}
      >
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Search today's queue"
          title="Search today's queue"
          aria-expanded={expanded}
          aria-controls={searchId}
          onClick={() => {
            setExpanded(true)
            setShowSuggestions(true)
          }}
          className="size-[38px] shrink-0 rounded-full text-muted-foreground transition-transform hover:scale-105 active:scale-95 motion-reduce:transform-none"
        >
          <SearchIcon className="size-4" />
        </Button>
        {expanded && (
          <div id={searchId} className="flex min-w-0 flex-1 items-center gap-1 pr-1.5">
            <input
              type="text"
              autoFocus
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && results.length ? `${listId}-${highlightedIndex}` : undefined}
              aria-label="Find a patient in today's queue by queue number or name"
              placeholder="Queue number or name"
              value={query}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              onChange={e => {
                setQuery(e.target.value)
                setShowSuggestions(true)
                setHighlightedIndex(0)
              }}
              onFocus={() => setShowSuggestions(true)}
              onClick={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close queue search"
              onClick={closeSearch}
              className="group size-7 rounded-full"
            >
              <CrossIcon width={20} height={20} color="currentColor" />
            </Button>
          </div>
        )}
      </div>

      {open && (
        <div
          className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in slide-in-from-top-1 zoom-in-[0.98] duration-150 motion-reduce:animate-none"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {trimmed ? `${results.length} ${results.length === 1 ? "match" : "matches"}` : "Up next"}
            </span>
            {patients.length > 0 && <span>{patients.length} in today&apos;s queue</span>}
          </div>

          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Patients in today's queue" className="max-h-80 overflow-y-auto p-1">
              {results.map((patient, idx) => {
                const isOpening = opening === patient.visit_id
                const highlighted = opening ? isOpening : idx === highlightedIndex
                const here = Boolean(station) && patient.current_station === station
                const destination = patient.current_station
                  ? here ? "Open here" : `Open in ${stationLabel(patient.current_station)}`
                  : "Open record"
                return (
                  <li key={patient.visit_id} id={`${listId}-${idx}`} role="option" aria-selected={highlighted}>
                    <button
                      type="button"
                      tabIndex={-1}
                      title={destination}
                      aria-busy={isOpening}
                      disabled={Boolean(opening)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-[background-color,opacity] duration-150",
                        highlighted ? "bg-accent" : "hover:bg-accent/60",
                        opening && !isOpening && "opacity-40",
                      )}
                      onMouseEnter={() => { if (!opening) setHighlightedIndex(idx) }}
                      onClick={() => handlePatientSelect(patient)}
                    >
                      <span className="grid h-8 min-w-10 shrink-0 place-items-center rounded-md bg-muted px-1.5 text-sm font-semibold tabular-nums">
                        {patient.queue_no}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{patient.english_name || "Unknown name"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[patient.khmer_name?.trim(), patient.station_arrival_time && `Waiting since ${patient.station_arrival_time}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {here && (
                        <span className="shrink-0 rounded-full border border-primary/30 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                          Here
                        </span>
                      )}
                      {isOpening ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary" role="status">
                          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          {patient.current_station ? `Opening ${stationLabel(patient.current_station)}…` : "Opening record…"}
                        </span>
                      ) : (
                        <StationBadge station={patient.current_station} />
                      )}
                      <ArrowRight
                        aria-hidden="true"
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition duration-150 motion-reduce:transform-none",
                          highlighted ? "translate-x-0.5 text-foreground opacity-100" : "opacity-0 group-hover:opacity-100",
                        )}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {results.length > 0 && (
            <div className="flex items-center gap-3 border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              <span><kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> to move</span>
              <span className="inline-flex items-center gap-1"><CornerDownLeft className="size-3" aria-hidden="true" /> to open</span>
              <span>Esc to close</span>
              {!trimmed && patients.length > results.length && <span className="ml-auto">Type to search all</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
