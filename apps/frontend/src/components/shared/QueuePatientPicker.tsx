"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageCard } from "@/components/shared/PageCard";
import { SearchIcon } from "@/assets/icons/SearchIcon";
import { QueuedPatient } from "@/lib/types/patient";
import { getQueue } from "@/lib/api/queue/getQueue";
import { useLocationStore } from "@/stores/useLocationStore";
import { useUserStore } from "@/stores/useUserStore";

interface QueuePatientPickerProps {
  onSelectPatient: (patient: QueuedPatient) => void;
  selectedVisitId?: number;
}

function sortQueueNumber(a: QueuedPatient, b: QueuedPatient) {
  const extractParts = (queueNum: string) => {
    const match = queueNum.match(/^(\d+)([A-Za-z]?)$/);
    if (match) {
      return {
        number: Number.parseInt(match[1], 10),
        letter: match[2] || "ZZ",
      };
    }
    return { number: Number.MAX_SAFE_INTEGER, letter: queueNum };
  };

  const partsA = extractParts(a.queue_no);
  const partsB = extractParts(b.queue_no);
  if (partsA.number !== partsB.number) return partsA.number - partsB.number;
  return partsA.letter.localeCompare(partsB.letter);
}

export default function QueuePatientPicker({
  onSelectPatient,
  selectedVisitId,
}: QueuePatientPickerProps) {
  const location = useLocationStore((state) => state.currentLocation);
  const token = useUserStore((state) => state.user?.token);

  const [patients, setPatients] = useState<QueuedPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadQueue = async () => {
      if (!location || !token) {
        setPatients([]);
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const queuePatients = await getQueue(location.id, date, token);
      setPatients(Array.isArray(queuePatients) ? queuePatients : []);
    };

    loadQueue();
  }, [location, token]);

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
    return [...filtered].sort(sortQueueNumber);
  }, [patients, searchQuery]);

  return (
    <PageCard
      title="Queue Patients"
      action={<Badge variant="inactive">Today</Badge>}
      className="xl:col-span-4"
      contentClassName="space-y-3"
      headerExtra={
        <div className="relative mt-4">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by queue or name"
            className="pl-10"
          />
        </div>
      }
    >
      {sortedPatients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {searchQuery ? "No patients match this search." : "No patients in queue today."}
        </p>
      ) : (
        sortedPatients.map((patient) => {
          const isSelected = selectedVisitId === patient.visit_id;
          return (
            <button
              key={`${patient.visit_id}-${patient.queue_no}`}
              type="button"
              onClick={() => onSelectPatient(patient)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent/60"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <Badge variant={isSelected ? "active" : "inactive"}>{patient.queue_no}</Badge>
                <span className="text-xs text-muted-foreground">{patient.timestamp}</span>
              </div>
              <p className="mt-2 font-medium text-foreground">{patient.english_name || "Unknown name"}</p>
              <p className="text-sm text-muted-foreground">{patient.khmer_name || "-"}</p>
            </button>
          );
        })
      )}
    </PageCard>
  );
}
