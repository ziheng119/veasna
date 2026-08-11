"use client"

import React, { useEffect, useMemo, useState } from "react"
import { DrugTable } from "@/components/pharmacy/DrugTable"
import { Drug } from "@/lib/types/drug"
import { PageHeader } from "@/components/pharmacy/PageHeader"
import { PlusIcon } from "@/assets/icons"
import { AddDrugSidebar } from "@/components/pharmacy/AddDrugSidebar"
import { FullSearchBar } from "@/components/patient-list/FullSearchBar"
import { getDrugsByLocation, addDrug, updateDrugCount, updateDrugName, deleteDrug } from "@/lib/api/pharmacy/pharmacy"
import { useLocationStore } from "@/stores/useLocationStore"
import toast from "react-hot-toast"
import { SET_LOCATION_MESSAGE } from "@/messages/info"
import { Button } from "@/components/ui/button"

export default function Pharmacy() {
    const [isLoading, setIsLoading] = useState<boolean>(true)

    const [drugs, setDrugs] = useState<Drug[]>([])
    const [searchTerm, setSearchTerm] = useState<string>("")
    const [showAddTab, setShowAddTab] = useState<boolean>(false)

    const location = useLocationStore((state) => state.currentLocation)

    useEffect(() => {
      if (!location) {
        toast(SET_LOCATION_MESSAGE);
      }
    }, [location]);

    async function refreshDrugs() {
      if (location) {
        const db_drugs = await getDrugsByLocation(location.id);
        setDrugs(db_drugs)
        setIsLoading(false)
      }
    }

    useEffect(() => {
      refreshDrugs()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    const filteredDrugs = useMemo(() => {
        if (!searchTerm.trim()) {
            return drugs
        }

        const searchLower = searchTerm.toLowerCase()
        return drugs.filter((drug) =>
          drug.drug_name.toLowerCase().includes(searchLower)
        )
    }, [drugs, searchTerm])

    const handleSearchChange = (term: string) => {
        setSearchTerm(term)
    }

    const handleStockCountChange = async (drugId: number, newCount: number) => {
      try {
        const updatedDrug = await updateDrugCount(drugId, newCount);
        setDrugs(prevDrugs =>
          prevDrugs.map((drug) =>
            drug.id === drugId ? updatedDrug : drug
          )
        );
      } catch (error) {
        toast.error("Failed to update stock count.");
      }
    }

    const handleDrugNameChange = async (drugId: number, newName: string) => {
      try {
        const updatedDrug = await updateDrugName(drugId, newName);
        setDrugs(prevDrugs =>
          prevDrugs.map((drug) =>
            drug.id === drugId ? updatedDrug : drug
          )
        );
        toast.success(`Drug renamed to "${updatedDrug.drug_name}".`);
      } catch (error) {
        toast.error("Failed to rename drug. It may already exist.");
      }
    }

    const handleDeleteDrug = async (drugId: number) => {
        if (window.confirm('Are you sure you want to delete this drug?')) {
          try {
            await deleteDrug(drugId);
            setDrugs(prevDrugs => prevDrugs.filter(drug => drug.id !== drugId));
            toast.success("Drug deleted successfully.");
          } catch (error) {
            toast.error("Failed to delete drug.");
          }
        }
    }

    const handleAddDrug = async (newDrugData: { drug_name: string; stock_count: number }) => {
      if (!location) {
        toast.error("No Location Selected !");
        return;
      }
      try {
        const payload = { ...newDrugData, location_id: location.id };
        const newDrug = await addDrug(payload);
        setDrugs(prevDrugs => [...prevDrugs, newDrug]);
        toast.success(`${newDrug.drug_name} added to inventory.`);
      } catch (error) {
        toast.error("Failed to add new drug.");
      }
    }

    return (
      <div className="space-y-5">
          <div>
            <PageHeader />

            <div className="flex items-center justify-between">
              <FullSearchBar
               onSearchChange={handleSearchChange}
               placeholder={"Search drugs..."}
              />

              <Button
                onClick={() => setShowAddTab(!showAddTab)}
                size="icon"
                className="ml-4 rounded-full"
              >
                <PlusIcon className='w-5 h-5'/>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className={showAddTab ? "xl:col-span-8" : "xl:col-span-12"}>
              <DrugTable
                drugs={filteredDrugs}
                onStockCountChange={handleStockCountChange}
                onDrugNameChange={handleDrugNameChange}
                onDeleteDrug={handleDeleteDrug}
              />
            </div>

            {showAddTab && (
              <div className="xl:col-span-4">
              <AddDrugSidebar
                onSubmit={handleAddDrug}
              />
              </div>
            )}
        </div>
      </div>
    )
}
