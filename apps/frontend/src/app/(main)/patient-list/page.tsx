"use client"

import { PlusIcon } from "@/assets/icons";
import { FullSearchBar } from "@/components/patient-list/FullSearchBar";
import { PatientPageHeader } from "@/components/patient-list/PageHeader";
import { PatientTable } from "@/components/patient-list/PatientTable";
import { Location } from "@/lib/types/location";
import { PatientInfo } from "@/lib/types/patient";
import { useLocationStore } from "@/stores/useLocationStore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import toast from "react-hot-toast";
import { getPatientsByLocation } from "@/lib/api/patients/getPatientsByLocation";
import { deletePatient } from "@/lib/api/patients/deletePatient";
import { useUserStore } from "@/stores/useUserStore";
import { Button } from "@/components/ui/button";

export default function PatientListPage() {

  const router = useRouter();

  const location: Location | null = useLocationStore((state) => state.currentLocation)
  const token = useUserStore((state) => state.user?.token)

  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    if (!location) {
      toast(SET_LOCATION_MESSAGE);
    }
  }, [location]);

  // API helper functions
  async function refreshAllPatients() {
    if (token && location) {
      const db_patients = await getPatientsByLocation(location.id, token);
      setPatients(db_patients);
    }
  }

  // API useEffects
  useEffect(() => {
    if (token && location) {
      refreshAllPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, token])
  
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
  
  const handleAddPatient = () => {
    console.log('Add new patient Clicked');
    router.push('/patient-form?mode=new');
  };

  const handleViewPatient = (patientId: number) => {
    console.log('Viewing Patient, ', patientId);
    router.push(`/patient-details?id=${patientId}`);
  }

  const handleDeletePatient = async (patientId: number) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) return;
    if (!token) return;
    try {
      await deletePatient(patientId, token);
      setPatients(prevPatients => prevPatients.filter(patient => patient.id !== patientId));
    } catch (error) {
      console.error('Delete patient error:', error);
      toast.error('Failed to delete patient');
    }
  };

  return (
    <div className="space-y-5">
      <PatientPageHeader/>

      <div className='flex items-center justify-between gap-4'>
        <FullSearchBar
          placeholder= "Search for Patient by English Name or Khmer Name"
          onSearchChange={handleSearchChange}
        />

        <Button
          onClick={handleAddPatient}
          size="icon"
          className="rounded-full"
        >
          <PlusIcon className="w-5 h-5"/>
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