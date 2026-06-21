"use client"

import { useEffect, useState } from "react"
import { SearchIcon } from "@/assets/icons/SearchIcon"
import { CrossIcon } from "@/assets/icons/CrossIcon"
import { useLocationDataStore } from "@/stores/useLocationDataStore"
import { QueuedPatient } from "@/lib/types/patient"
import { Location } from "@/lib/types/location"
import { useLocationStore } from "@/stores/useLocationStore"
import { SET_LOCATION_MESSAGE } from "@/messages/info"
import toast from "react-hot-toast"
import { getPatientsByLocation } from "@/lib/api/patients/getPatientsByLocation"
import { getQueue } from "@/lib/api/queue/getQueue"
import { useUserStore } from "@/stores/useUserStore"

interface SearchBarProps {
  onSelectPatient?: (patient: QueuedPatient) => void
}

export default function SearchBar({ onSelectPatient }: SearchBarProps) {
  const token = useUserStore((state) => state.user?.token)
  const location: Location | null = useLocationStore(state => state.currentLocation)

  const [patients, setPatients] = useState<QueuedPatient[]>([])
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

  const handleClearQuery = () => {
    setQuery("")
    setHighlightedIndex(-1)
  }

  useEffect(() => {
    async function getAllPatients() {
      if (!token) {
        return
      }
      if (!location) {
        toast(SET_LOCATION_MESSAGE)
        return
      }
      const date = new Date().toISOString().slice(0, 10);
      const db_patients = await getQueue(location.id, date.toString(), token);
      setPatients(db_patients)
    }

    getAllPatients();
  }, [location])

  return (
    <div className="relative w-full text-gray-700">
      <div className="flex flex-wrap items-center bg-white rounded-full w-full p-2 border-[1px] gap-1">
        <SearchIcon className="ml-1" />

        <input
          type="text"
          placeholder="Enter Queue Number"
          value={query}
          className="flex-1 min-w-[100px] outline-none ml-1"
          onChange={e => {
            setQuery(e.target.value)
            setShowSuggestions(true)
            setHighlightedIndex(-1)
          }}
          onClick={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
        />

        <CrossIcon 
          width={20} 
          height={20} 
          color="black" 
          onClick={handleClearQuery}
          className="hover:cursor-pointer"  
        />
      </div>

      {showSuggestions && query.trim() !== "" && filteredPatients.length > 0 && (
        <ul className="absolute z-10 bg-white border border-gray-300 rounded-md w-full mt-1 max-h-48 overflow-y-auto">
          {filteredPatients.map((patient, idx) => (
            <li
              key={patient.patient_id ?? idx}
              className={`px-4 py-2 cursor-pointer ${
                idx === highlightedIndex ? "bg-gray-100 font-medium" : "hover:bg-gray-100"
              }`}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onMouseDown={() => handlePatientSelect(patient)}
            >
              <span className="font-medium">{patient.queue_no}</span> - {patient.english_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
