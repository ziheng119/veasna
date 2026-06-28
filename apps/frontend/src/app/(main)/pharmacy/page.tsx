"use client"

import React, { useEffect, useMemo, useState } from "react"
import { DrugTable } from "@/components/pharmacy/DrugTable"
import { Drug } from "@/lib/types/drug"
import { PageHeader } from "@/components/pharmacy/PageHeader"
import { PlusIcon } from "@/assets/icons"
import { AddDrugSidebar } from "@/components/pharmacy/AddDrugSidebar"
import { FullSearchBar } from "@/components/patient-list/FullSearchBar"
import { getDrugsByLocation } from "@/lib/api/pharmacy/pharmacy"
import { addDrug } from "@/lib/api/pharmacy/pharmacy"
import { updateDrugStock } from "@/lib/api/pharmacy/pharmacy"
import { deleteDrug } from "@/lib/api/pharmacy/pharmacy"
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
    
    // load drugs
    useEffect(() => {
      refreshDrugs()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]);

    // if there is a change in the searchTerm or drug, filteredDrugs is recalculated
    const filteredDrugs = useMemo(() => {
        if (!searchTerm.trim()) {
            return drugs
        }

        const searchLower = searchTerm.toLowerCase()
        return drugs.filter((drug) =>
        drug.drug_name.toLowerCase().includes(searchLower) ||
        drug.stock_level.toLowerCase().includes(searchLower)
        )
    }, [drugs, searchTerm])

    // to change with db 
    const handleSearchChange = (term: string) => {
        setSearchTerm(term)
    }

    const handleStockLevelChange = async (drugId: number, newLevel: Drug['stock_level']) => {
      try {
        const updatedDrug = await updateDrugStock(drugId, newLevel);
        setDrugs(prevDrugs =>
          prevDrugs.map((drug) =>
            drug.id === drugId ? updatedDrug : drug
          )
        );
        toast.success(`${updatedDrug.drug_name} stock updated.`);
      } catch (error) {
        toast.error("Failed to update stock level.");
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

    // to change with db
    const handleAddDrug = async (newDrugData: { drug_name: string, stock_level: Drug['stock_level'] }) => {
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
               placeholder={"Search drugs or ID..."}
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
            {/* Drug Tablee */}
            <div className={showAddTab ? "xl:col-span-8" : "xl:col-span-12"}>
              <DrugTable 
                drugs={filteredDrugs}
                onStockLevelChange={handleStockLevelChange}
                onDeleteDrug={handleDeleteDrug}
              />
            </div>

            {/* Add Drug Form */}
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