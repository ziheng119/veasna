"use client"

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { ArrowLeftIcon, SearchIcon, CalendarIcon, ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PatientInfoCard, { PatientRecord } from "@/components/patient-details/PatientInfoCard";
import VisitRecordTabs from "@/components/patient-details/VisitRecordTabs";
import { clearPatientCache, getPatient } from "@/lib/api/patient/getPatients";
import { clearVisitCache, getVisit } from "@/lib/api/visit/getVisit";
import { canEditSavedData } from "@/lib/permissions";
import formatDate from "@/helper/format_date";
import { VisitDetails, VisitSummary } from "@/lib/types/visit";
import { PAGE_SHELL, PANEL_SCROLL, PANEL_WRAPPER, STABLE_SCROLLBAR } from "@/lib/pageLayout";
import { ENTER, ENTER_FAST, PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Back buttons nudge their arrow on hover, like the analytics page.
const BACK_BUTTON = cn("group flex items-center gap-2 rounded-full", PRESS);
const BACK_ARROW = "w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transform-none";
// Stagger the first few visit cards; later ones appear together so long lists stay quick.
const MAX_STAGGERED_VISITS = 8;

interface PatientData {
  patient: PatientRecord;
  visits: VisitSummary[];
}

/**
 * A patient's demographics and full visit history. Everyone can read it; admins can correct
 * the patient details and every record of a visit, one section at a time.
 */
export default function PatientDetailsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = Number(searchParams.get('id'));
  const token = useUserStore((state) => state.user?.token);
  const canEdit = useUserStore((state) => canEditSavedData(state.user?.role));

  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [visitDetails, setVisitDetails] = useState<VisitDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVisit, setIsLoadingVisit] = useState(false);
  const [dateSearch, setDateSearch] = useState("");

  useEffect(() => {
    if (!patientId) {
      setIsLoading(false);
      return;
    }
    if (!token) return;

    setIsLoading(true);
    getPatient(patientId, token)
      .then(data => {
        if (data) setPatientData(data);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [patientId, token]);

  const filteredVisits = useMemo(() => {
    if (!patientData?.visits) return [];
    if (!dateSearch.trim()) return patientData.visits;
    return patientData.visits.filter(visit => visit.visit_date.includes(dateSearch));
  }, [patientData?.visits, dateSearch]);

  const handleVisitClick = async (visit: VisitSummary) => {
    if (!token) return;
    setSelectedVisitId(visit.visit_id);
    setIsLoadingVisit(true);
    try {
      setVisitDetails(await getVisit(visit.visit_id, token));
    } catch (error) {
      console.error('Error fetching visit details:', error);
    } finally {
      setIsLoadingVisit(false);
    }
  };

  // After an admin edit, reload the visit and the visit list (queue number, date and badges).
  const reloadSelectedVisit = useCallback(async () => {
    if (!token || selectedVisitId === null) return;
    clearVisitCache(selectedVisitId);
    clearPatientCache(patientId);
    const [details, patient] = await Promise.all([
      getVisit(selectedVisitId, token),
      getPatient(patientId, token),
    ]);
    if (details) setVisitDetails(details);
    if (patient) setPatientData(patient);
  }, [token, selectedVisitId, patientId]);

  const handleBackToVisitList = () => {
    setSelectedVisitId(null);
    setVisitDetails(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading patient details...</div>;
  }

  if (!patientData) {
    return <div className="flex items-center justify-center h-screen">Patient not found.</div>;
  }

  const { patient, visits } = patientData;
  const selectedSummary = visits.find(visit => visit.visit_id === selectedVisitId);

  return (
    <div className={PAGE_SHELL}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push('/patient-list')}
          className={BACK_BUTTON}
        >
          <ArrowLeftIcon className={BACK_ARROW} />
          Back to Patient List
        </Button>
        {!canEdit && (
          <p className="text-sm text-muted-foreground">Read-only. Only an admin can change saved data.</p>
        )}
      </div>

      {/* Main Layout: Patient Info (Left 1/3) + Visits/Details (Right 2/3) */}
      <div className="grid grid-cols-3 gap-6 xl:grid-rows-1 xl:min-h-0 xl:flex-1">
        <div className={cn("col-span-1", PANEL_SCROLL, STABLE_SCROLLBAR, ENTER)}>
          <PatientInfoCard
            patient={patient}
            canEdit={canEdit}
            onSaved={(updated) => setPatientData(previous => previous && { ...previous, patient: { ...previous.patient, ...updated } })}
          />
        </div>

        {/* Right Side: Visits List OR Visit Details */}
        <div className={`col-span-2 ${PANEL_WRAPPER}`}>
          {selectedVisitId === null ? (
            <Card key="visit-list" className={cn("xl:min-h-0 xl:max-h-full", ENTER_FAST)}>
              <CardHeader>
                <div>
                  <CardTitle>Visit History</CardTitle>
                  <CardDescription>{visits.length} total visits</CardDescription>
                </div>
                <div className="relative mt-4">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    placeholder="Search by date..."
                    value={dateSearch}
                    onChange={(e) => setDateSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent className={cn(PANEL_SCROLL, STABLE_SCROLLBAR, "xl:flex-1")}>
                {/* Padding leaves room for the hover lift and focus ring inside the scrolling panel. */}
                <div className="space-y-3 p-1">
                  {filteredVisits.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {dateSearch ? 'No visits found for this date' : 'No visits recorded'}
                    </p>
                  ) : (
                    filteredVisits.map((visit, index) => (
                      <button
                        type="button"
                        key={visit.visit_id}
                        onClick={() => handleVisitClick(visit)}
                        style={{ animationDelay: `${Math.min(index, MAX_STAGGERED_VISITS) * 40}ms` }}
                        className={cn(
                          "group block w-full cursor-pointer rounded-xl border border-border bg-card p-4 text-left",
                          "transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 motion-reduce:transform-none",
                          ENTER_FAST, PRESS,
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CalendarIcon className="h-5 w-5 text-primary" />
                              <span className="font-bold text-lg text-foreground">
                                {formatDate(visit.visit_date)}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground ml-7">
                              Queue: <span className="font-medium">{visit.queue_no}</span> • {visit.location_name}
                            </div>
                            <div className="flex gap-2 mt-3 ml-7 flex-wrap">
                              {visit.has_vitals && <Badge variant="active">Triage</Badge>}
                              {visit.has_seva && <Badge variant="info">Seva</Badge>}
                              {visit.has_physiotherapy && <Badge variant="warning">Physiotherapy</Badge>}
                              {visit.has_consultation && <Badge variant="secondary">Consultation</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            Updated: {new Date(visit.last_updated_at).toLocaleDateString()}
                            <ChevronRightIcon
                              aria-hidden="true"
                              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none"
                            />
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key="visit-details" className={cn("xl:min-h-0 xl:max-h-full", ENTER_FAST)}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToVisitList}
                    className={BACK_BUTTON}
                  >
                    <ArrowLeftIcon className={BACK_ARROW} />
                    Back to Visits
                  </Button>
                </div>
                <div className="mt-2">
                  {/* Prefer the loaded visit so admin edits to date, queue or location show at once. */}
                  <CardTitle className="text-2xl">
                    {formatDate(visitDetails?.visit_date ?? selectedSummary?.visit_date ?? null)}
                  </CardTitle>
                  <CardDescription className="text-base mt-1">
                    Queue {visitDetails?.queue_no ?? selectedSummary?.queue_no} • {visitDetails?.location_name ?? selectedSummary?.location_name}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className={cn(PANEL_SCROLL, STABLE_SCROLLBAR, "xl:flex-1")}>
                {isLoadingVisit ? (
                  <div className="space-y-4" aria-busy="true" aria-label="Loading visit details">
                    <div className="h-11 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                    {[0, 1].map((i) => (
                      <div key={i} className="h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                  </div>
                ) : visitDetails ? (
                  <VisitRecordTabs visit={visitDetails} canEdit={canEdit} onSaved={reloadSelectedVisit} />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Failed to load visit details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
