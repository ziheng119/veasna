"use client"

import { useCallback, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { SearchIcon } from "@/assets/icons/SearchIcon"
import { CrossIcon } from "@/assets/icons/CrossIcon"
import { QueuedPatient } from "@/lib/types/patient"
import { Location } from "@/lib/types/location"
import { useLocationStore } from "@/stores/useLocationStore"
import { useLiveList } from "@/hooks/useLiveList"
import { getQueue } from "@/lib/api/queue/getQueue"
import { useUserStore } from "@/stores/useUserStore"

interface SearchBarProps {
  onSelectPatient?: (patient: QueuedPatient) => void
}

export default function SearchBar({ onSelectPatient }: SearchBarProps) {
  const [expanded, setExpanded] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchId = useId()
  const token = useUserStore((state) => state.user?.token)
  const location: Location | null = useLocationStore(state => state.currentLocation)

  const locationId = location?.id;
  const load = useCallback(async (signal: AbortSignal): Promise<QueuedPatient[]> => {
    if (!locationId || !token) return [];
    return getQueue(locationId, new Date().toISOString().slice(0, 10), token, undefined, signal);
  }, [locationId, token]);
  const { data: patients } = useLiveList(load);
  const [query, setQuery] = useState<string>("")
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  // Filter patients based on queue number
  const filteredPatients = patients.filter(
    (patient) => patient.queue_no.toLowerCase().includes(query.toLowerCase())
  )

  const handlePatientSelect = (patient: QueuedPatient) => {
    setQuery(patient.queue_no)
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    if (onSelectPatient) onSelectPatient(patient)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      closeSearch()
      return
    }
    if (!showSuggestions || filteredPatients.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex(prev =>
        prev < filteredPatients.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex(prev =>
        prev > 0 ? prev - 1 : filteredPatients.length - 1
      )
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < filteredPatients.length) {
        handlePatientSelect(filteredPatients[highlightedIndex])
      }
    }
  }

  // Collapsing only dismisses the lookup; it does not clear the selected patient.
  const closeSearch = () => {
    setExpanded(false)
    setQuery("")
    setShowSuggestions(false)
    setHighlightedIndex(-1)
    triggerRef.current?.focus()
  }

  return (
    <div className="relative w-full text-foreground">
      {/* Keep one border and icon mounted so the circle expands into the field. */}
      <div
        className="flex h-10 items-center overflow-hidden rounded-full border border-border bg-card transition-[width] duration-300 ease-out motion-reduce:transition-none"
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
        onClick={() => setExpanded(true)}
        className="size-[38px] shrink-0 rounded-full text-muted-foreground"
      >
        <SearchIcon className="size-4" />
      </Button>
      {expanded && (
      <div id={searchId} className="flex min-w-0 flex-1 items-center gap-1 pr-1.5">

        <input
          type="text"
          autoFocus
          aria-label="Find patient across today's queue by queue number"
          placeholder="Find in today's queue by number"
          value={query}
          className="min-w-0 flex-1 outline-none bg-transparent placeholder:text-muted-foreground"
          onChange={e => {
            setQuery(e.target.value)
            setShowSuggestions(true)
            setHighlightedIndex(-1)
          }}
          onClick={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
        />

        <Button type="button" variant="ghost" size="icon" aria-label="Close queue search" onClick={closeSearch} className="size-7 rounded-full">
          <CrossIcon width={20} height={20} color="currentColor" />
        </Button>
      </div>
      )}
      </div>
      {expanded && showSuggestions && query.trim() !== "" && filteredPatients.length > 0 && (
        <ul className="absolute z-10 bg-card border border-border rounded-md w-full mt-1 max-h-48 overflow-y-auto shadow-sm">
          {filteredPatients.map((patient, idx) => (
            <li key={patient.visit_id}>
            <button
              type="button"
              className={`px-4 py-2 cursor-pointer ${
                idx === highlightedIndex ? "bg-accent font-medium" : "hover:bg-accent/70"
              } w-full text-left`}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={() => handlePatientSelect(patient)}
            >
              <span className="font-medium">{patient.queue_no}</span> - {patient.english_name}
            </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
