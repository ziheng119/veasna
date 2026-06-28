"use client"

import { Badge } from "../ui/badge";
import { useEffect, useState } from "react";
import { Input } from "../ui/input";
import { SearchIcon } from "@/assets/icons";
import { useLocationDataStore } from "@/stores/useLocationDataStore";
import { QueuedPatient } from "@/lib/types/patient";
import { useLocationStore } from "@/stores/useLocationStore";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";
import { useUserStore } from "@/stores/useUserStore";
import { getPatientsByLocation } from "@/lib/api/patients/getPatientsByLocation";
import { getQueue } from "@/lib/api/queue/getQueue";
import { PageCard } from "../shared/PageCard";

function sortQueueNumber(a: QueuedPatient, b: QueuedPatient) {
    // Extract the number and parts portion
    const extractParts = (queueNum: string) => {
        const match = queueNum.match(/^(\d+)([A-Za-z]?)$/);
        if (match) {
            return {
                number: parseInt(match[1]),
                letter: match[2] || 'ZZ' // put numbers without letters as last?
            }
        }
        return { number: 999999, letter: queueNum };
    };

    const partsA = extractParts(a.queue_no);
    const partsB = extractParts(b.queue_no);

    // Sort by number first
    if (partsA.number !== partsB.number) {
        return partsA.number - partsB.number;
    }

    return partsA.letter.localeCompare(partsB.letter);
}

interface Props {
  patients: QueuedPatient[];
}

export function PatientQueue({ patients }: Props) {
  const location = useLocationStore((state) => state.currentLocation);
  const token = useUserStore((state) => state.user?.token);

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

  const sortedPatients = [...filteredPatients].sort(sortQueueNumber);
  const today = new Date().toLocaleDateString();

  return (
    <PageCard
      title="Today's Queue"
      action={<Badge variant="inactive">{today}</Badge>}
      className="h-full flex flex-col"
      contentClassName="flex-1 overflow-y-auto space-y-3 bg-card"
      headerExtra={
        <div className="relative mt-4">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name or queue number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-input text-foreground placeholder-muted-foreground"
          />
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
              key={`${patient.queue_no}-${patient.timestamp}`}
              className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors bg-card"
            >
              <div className="flex items-center space-x-3">
                <Badge variant="active" className="font-mono min-w-12 justify-center">
                  {patient.queue_no}
                </Badge>
                <div>
                  <div className="font-medium text-foreground">{patient.english_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {patient.khmer_name}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{patient.age}y, {patient.sex}</div>
                <div>{patient.timestamp}</div>
              </div>
            </div>
          ))
        )}
    </PageCard>
  );
}