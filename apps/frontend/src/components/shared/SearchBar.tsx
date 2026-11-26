"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowRight, CornerDownLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SearchIcon } from "@/assets/icons/SearchIcon"
import { CrossIcon } from "@/assets/icons/CrossIcon"
import StationBadge from "./StationBadge"
import TbBadge from "./TbBadge"
import FamilyBadge from "./FamilyBadge";
import { QueuedPatient } from "@/lib/types/patient"
import { STATION_PAGES, StationId, stationLabel, stationPageHref } from "@/constants/stations"
import { useLiveList } from "@/hooks/useLiveList"
import { getQueue, CLINIC_TODAY } from "@/lib/api/queue/getQueue"
import { sortQueuePatients } from "@/lib/queueSort"
import { useUserStore } from "@/stores/useUserStore"
import { cn } from "@/lib/utils"
import { familyTone, groupFamilies } from "@/lib/family"

// With nothing typed, the dropdown previews the next few patients by queue number.
const UPCOMING_COUNT = 6
const MAX_RESULTS = 10

// Widths of the field: closed it is a round button in the top bar, open it is a search box.
// Closed, a circle the size of the Guide button (size-9) beside it.
const CLOSED_WIDTH = "2.25rem"
const OPEN_WIDTH = "18rem"

function matches(patient: QueuedPatient, query: string) {
  return [patient.queue_no, patient.english_name, patient.khmer_name]
    .some((text) => text?.toLowerCase().includes(query))
}

// "Family C (3 people), 2 more matches": the family's size, then whatever else the letter matched.
function familyHeading(family: string, results: QueuedPatient[]) {
  const size = results.filter((patient) => patient.family === family).length
  const more = results.length - size
  return `Family ${family} (${size} ${size === 1 ? "person" : "people"})${more ? `, ${more} more ${more === 1 ? "match" : "matches"}` : ""}`
}

// A family's letter on its own ("c") or after "family"/"fam" ("family c").
const FAMILY_QUERY = /^(?:fam(?:ily)?\s*)?([a-z]{1,3})$/

/**
 * Patients matching the query by queue number, name or family letter, in queue-number order. A
 * family named by its letter comes first; anyone found brings the rest of their family with them,
 * listed together. An exact queue number goes first, as it is almost always the one wanted.
 */
export function searchQueue(byNumber: QueuedPatient[], query: string) {
  const letter = query.match(FAMILY_QUERY)?.[1].toUpperCase()
  const family = letter && byNumber.some((patient) => patient.family === letter) ? letter : null
  const found = byNumber.filter((patient) => (family && patient.family === family) || matches(patient, query))
  const exact = found.findIndex((patient) => patient.queue_no.toLowerCase() === query)
  if (exact > 0) found.unshift(...found.splice(exact, 1))
  else if (family) found.sort((a, b) => Number(b.family === family) - Number(a.family === family))
  const families = new Set(found.map((patient) => patient.family).filter(Boolean))
  const relatives = byNumber.filter((patient) => patient.family && families.has(patient.family) && !found.includes(patient))
  return { family, results: groupFamilies([...found, ...relatives], (patient) => patient.family) }
}

/**
 * Today's whole clinic, searchable by queue number or name, showing where each patient is. It sits in
 * the top bar (TopNav), so it is on every page. A patient opens on their station's page (?visit=, picked
 * up by QueuePatientPicker), in place when that page is already open.
 */
export default function SearchBar() {
  const router = useRouter()
  const pathname = usePathname()
  const station = (Object.keys(STATION_PAGES) as StationId[]).find((id) => STATION_PAGES[id] === pathname)
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

  const load = useCallback(async (signal: AbortSignal): Promise<QueuedPatient[]> => {
    if (!token) return []
    return getQueue(CLINIC_TODAY, token, undefined, signal)
  }, [token])
  const { data: patients } = useLiveList(load)

  const trimmed = query.trim().toLowerCase()
  const byNumber = useMemo(() => sortQueuePatients(patients, "number"), [patients])
  const { results, family: familyFound } = useMemo(() => {
    if (!trimmed) return { results: byNumber.slice(0, UPCOMING_COUNT), family: null }
    const { results, family } = searchQueue(byNumber, trimmed)
    return { results: results.slice(0, MAX_RESULTS), family }
  }, [byNumber, trimmed])

  const open = expanded && (showSuggestions || isNavigating)

  // The search stays mounted in the top bar, so it closes itself once the chosen page has opened.
  const [shownOn, setShownOn] = useState(pathname)
  if (shownOn !== pathname) {
    setShownOn(pathname)
    setExpanded(false)
    setQuery("")
    setShowSuggestions(false)
    setHighlightedIndex(0)
    setOpeningVisitId(null)
  }

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
    // Every station is done but the visit is still open: show the patient's record.
    const href = current ? stationPageHref(current, patient.visit_id) : `/patient-details?id=${patient.patient_id}`
    if (current && current === station) {
      closeSearch()
      router.replace(href, { scroll: false })
      return
    }
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

  const emptyMessage = trimmed
      ? `No patient in today's queue matches "${query.trim()}".`
      : "No patients in today's queue yet."

  return (
    <div
      ref={containerRef}
      data-tour="clinic-search"
      className="relative shrink-0 text-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none"
      style={{ width: expanded ? OPEN_WIDTH : CLOSED_WIDTH }}
    >
      {/* Keep one border and icon mounted so the circle expands into the field. */}
      <div
        className={cn(
          "flex h-9 w-full items-center overflow-hidden rounded-full border transition-[transform,background-color,box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none",
          // Closed, styled like the Guide button: a blue-tinted circle that lifts on hover.
          !expanded ? "border-primary/30 bg-primary/5 hover:scale-110 hover:bg-primary/10 hover:shadow-md active:scale-95 motion-reduce:transform-none"
            : open ? "border-primary/40 bg-card shadow-md ring-2 ring-primary/10" : "border-border bg-card",
        )}
      >
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Search everyone in today's clinic"
          title="Search today's patients"
          aria-expanded={expanded}
          aria-controls={searchId}
          onClick={() => {
            setExpanded(true)
            setShowSuggestions(true)
          }}
          className="size-[34px] shrink-0 rounded-full text-primary hover:bg-transparent hover:text-primary"
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
              aria-label="Find a patient or family in today's clinic by queue number, name or family letter"
              placeholder="Number, name or family"
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
              aria-label="Close clinic search"
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
          className="absolute left-0 z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in slide-in-from-top-1 zoom-in-[0.98] duration-150 motion-reduce:animate-none"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {!trimmed ? "Up next"
                : familyFound ? familyHeading(familyFound, results)
                : `${results.length} ${results.length === 1 ? "match" : "matches"}`}
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
                // A family's rows next to each other share one dotted border, drawn over them so the
                // rows keep their size; each row is still hovered and picked on its own.
                const family = patient.family
                const joinsAbove = !!family && results[idx - 1]?.family === family
                const joinsBelow = !!family && results[idx + 1]?.family === family
                return (
                  <li key={patient.visit_id} id={`${listId}-${idx}`} role="option" aria-selected={highlighted} className="relative">
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
                      <span className={cn(
                        "grid h-8 min-w-10 shrink-0 place-items-center rounded-md px-1.5 text-sm font-bold tabular-nums",
                        patient.tb_flagged ? "bg-tb text-white" : "bg-muted",
                      )}>
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
                      {patient.tb_flagged && <TbBadge />}
                      {patient.family && <FamilyBadge family={patient.family} />}
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
                    {family && (joinsAbove || joinsBelow) && (
                      <span
                        aria-hidden="true"
                        data-family-edge={family}
                        className={cn(
                          "pointer-events-none absolute inset-0 border-x-2 border-dashed",
                          familyTone(family).box,
                          joinsAbove ? "border-t-0" : "rounded-t-xl border-t-2",
                          joinsBelow ? "border-b-0" : "rounded-b-xl border-b-2",
                        )}
                      />
                    )}
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
