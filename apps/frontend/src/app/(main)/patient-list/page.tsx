"use client"

import { PlusIcon } from "@/assets/icons";
import { CrossIcon } from "@/assets/icons/CrossIcon";
import { FullSearchBar } from "@/components/patient-list/FullSearchBar";
import { PatientPageHeader } from "@/components/patient-list/PageHeader";
import DownloadAllPatientsButton from "@/components/patient-list/DownloadAllPatientsButton";
import { PatientTable } from "@/components/patient-list/PatientTable";
import { PatientInfo } from "@/lib/types/patient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getPatientList } from "@/lib/api/patients/getPatientList";
import { deletePatient } from "@/lib/api/patients/deletePatient";
import { useUserStore } from "@/stores/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_SHELL } from "@/lib/pageLayout";
import { can } from "@/lib/permissions";
import { formatDayLabel } from "@/helper/format_date";
import { hostToday } from "@/stores/useHostClockStore";

import { useLiveList } from "@/hooks/useLiveList";
import { useConfirm } from "@/hooks/useConfirm";

export default function PatientListPage() {

  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  const token = useUserStore((state) => state.user?.token)
  const screeningDate = useUserStore((state) => state.user?.screening_date)
  // Without "See past patients" the list is the account's day only, so a date filter has nothing to choose.
  const seesPast = useUserStore((state) => can(state.user, "view_past"))
  const canRegister = useUserStore((state) => can(state.user, "edit_today"))

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [visitDate, setVisitDate] = useState<string>("");


  const loadPatients = useCallback(async (signal: AbortSignal): Promise<PatientInfo[]> => {
    if (!token) return [];
    return getPatientList(token, (seesPast && visitDate) || undefined, signal);
  }, [token, visitDate, seesPast]);
  const { data: patients, refresh: refreshAllPatients } = useLiveList(loadPatients);

  const filteredPatients: PatientInfo[] = useMemo(() => {
    if (!searchTerm.trim()) {
      return patients;
    }

    const searchLower = searchTerm.toLowerCase();

    return patients.filter((patient) => {
      const engName = patient.english_name?.toLowerCase() || "";
      const khmerName = patient.khmer_name?.toLowerCase() || "";

      return engName.includes(searchLower) || khmerName.includes(searchLower);
    });
  }, [patients, searchTerm]);


  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
  }
  
  const handleViewPatient = (patientId: number) => {
    router.push(`/patient-details?id=${patientId}`);
  }

  const handleDeletePatient = async (patientId: number) => {
    if (!token) return;
    const name = patients.find((patient) => patient.id === patientId)?.english_name || "this patient";
    if (!await confirm({
      title: `Delete ${name}?`,
      description: "Their details and every visit (triage, notes, referrals, prescriptions) are removed for good.",
      confirmLabel: "Delete patient",
    })) return;
    try {
      await deletePatient(patientId, token);
      await refreshAllPatients();
    } catch (error) {
      console.error('Delete patient error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete patient');
    }
  };

  return (
    <div className={PAGE_SHELL}>
      <PatientPageHeader/>

      <div className='flex items-center justify-between gap-4' data-tour="patient-search">
        <FullSearchBar
          placeholder= "Search for Patient by English Name or Khmer Name"
          onSearchChange={handleSearchChange}
        />

        <div className="flex items-center gap-2 shrink-0">
          <DownloadAllPatientsButton />
          {seesPast ? (
            <Input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              aria-label="Filter by visit date"
              className="w-auto"
            />
          ) : (
            <span className="text-sm text-muted-foreground" title="Seeing earlier days needs the &quot;See past patients&quot; permission">
              Patients queued {formatDayLabel(screeningDate || hostToday())}
            </span>
          )}
          {seesPast && visitDate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setVisitDate("")}
              title="Clear date filter"
            >
              <CrossIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        {canRegister && <Button
          asChild
          size="icon"
          className="rounded-full"
        >
          <Link href="/#patient-registration" aria-label="Add patient" title="Add patient">
            <PlusIcon className="w-5 h-5" />
          </Link>
        </Button>}
      </div>

      <PatientTable
        patients={filteredPatients}
        allPatients={patients}
        onViewPatient={handleViewPatient}
        onDeletePatient={handleDeletePatient}
        onFamilyChanged={refreshAllPatients}
      />
      {dialog}
    </div>
  )
}
