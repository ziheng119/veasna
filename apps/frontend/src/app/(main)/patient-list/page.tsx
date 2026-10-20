"use client"

import { PlusIcon } from "@/assets/icons";
import { CrossIcon } from "@/assets/icons/CrossIcon";
import { FullSearchBar } from "@/components/patient-list/FullSearchBar";
import { PatientPageHeader } from "@/components/patient-list/PageHeader";
import { PatientTable } from "@/components/patient-list/PatientTable";
import { Location } from "@/lib/types/location";
import { PatientInfo } from "@/lib/types/patient";
import { useLocationStore } from "@/stores/useLocationStore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";
import { getPatientsByLocation } from "@/lib/api/patients/getPatientsByLocation";
import { deletePatient } from "@/lib/api/patients/deletePatient";
import { useUserStore } from "@/stores/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_SHELL } from "@/lib/pageLayout";

import { useLiveList } from "@/hooks/useLiveList";

export default function PatientListPage() {

  const router = useRouter();

  const location: Location | null = useLocationStore((state) => state.currentLocation)
  const token = useUserStore((state) => state.user?.token)

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [visitDate, setVisitDate] = useState<string>("");

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);

  const locationId = location?.id;
  const loadPatients = useCallback(async (signal: AbortSignal): Promise<PatientInfo[]> => {
    if (!token || !locationId) return [];
    return getPatientsByLocation(locationId, token, visitDate || undefined, signal);
  }, [token, locationId, visitDate]);
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
    console.log('Viewing Patient, ', patientId);
    router.push(`/patient-details?id=${patientId}`);
  }

  const handleDeletePatient = async (patientId: number) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) return;
    if (!token) return;
    try {
      await deletePatient(patientId, token);
      await refreshAllPatients();
    } catch (error) {
      console.error('Delete patient error:', error);
      toast.error('Failed to delete patient');
    }
  };

  return (
    <div className={PAGE_SHELL}>
      <PatientPageHeader/>

      <div className='flex items-center justify-between gap-4'>
        <FullSearchBar
          placeholder= "Search for Patient by English Name or Khmer Name"
          onSearchChange={handleSearchChange}
        />

        <div className="flex items-center gap-2 shrink-0">
          <Input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            aria-label="Filter by visit date"
            className="w-auto"
          />
          {visitDate && (
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

        <Button
          asChild
          size="icon"
          className="rounded-full"
        >
          <Link href="/#patient-registration" aria-label="Add patient" title="Add patient">
            <PlusIcon className="w-5 h-5" />
          </Link>
        </Button>
      </div>

      <PatientTable
        patients={filteredPatients}
        onViewPatient={handleViewPatient}
        onDeletePatient={handleDeletePatient}
      />  
    </div>
  )
}
