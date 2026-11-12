"use client"

import React, { useEffect, useMemo, useState } from "react"
import { DrugTable } from "@/components/pharmacy/DrugTable"
import { Drug } from "@/lib/types/drug"
import { PageHeader } from "@/components/pharmacy/PageHeader"
import { PlusIcon } from "@/assets/icons"
import { AddDrugSidebar } from "@/components/pharmacy/AddDrugSidebar"
import { FullSearchBar } from "@/components/patient-list/FullSearchBar"
import { getDrugs, addDrug, updateDrugCount, updateDrugName, deleteDrug } from "@/lib/api/pharmacy/pharmacy"
import { useUserStore } from "@/stores/useUserStore"
import { can } from "@/lib/permissions"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";
import { useConfirm } from "@/hooks/useConfirm";

export default function PharmacyDashboard() {
  const { confirm, dialog } = useConfirm();
    const [isLoading, setIsLoading] = useState<boolean>(true)

    const [drugs, setDrugs] = useState<Drug[]>([])
    const [searchTerm, setSearchTerm] = useState<string>("")
    const [showAddTab, setShowAddTab] = useState<boolean>(false)

    // Adding drugs and changing stock: the "Pharmacy stock" permission. Without it the list is read-only.
    const canManage = useUserStore((state) => can(state.user, "pharmacy"))

    async function refreshDrugs() {
      try {
        setDrugs(await getDrugs())
      } catch {
        toast.error("Failed to load pharmacy stock.")
      } finally {
        setIsLoading(false)
      }
    }

    useEffect(() => {
      refreshDrugs()
    }, []);

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
        toast.error(error instanceof Error ? error.message : "Failed to update stock count.");
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
        const name = drugs.find(drug => drug.id === drugId)?.drug_name ?? "this medicine";
        if (await confirm({
          title: `Delete ${name}?`,
          description: "It is removed from the pharmacy's stock. Earlier prescriptions keep its name.",
          confirmLabel: "Delete medicine",
        })) {
          try {
            await deleteDrug(drugId);
            setDrugs(prevDrugs => prevDrugs.filter(drug => drug.id !== drugId));
            toast.success("Drug deleted successfully.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete drug.");
          }
        }
    }

    const handleAddDrug = async (newDrugData: { drug_name: string; stock_count: number }) => {
      try {
        const newDrug = await addDrug(newDrugData);
        setDrugs(prevDrugs => [...prevDrugs, newDrug]);
        toast.success(`${newDrug.drug_name} added to inventory.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to add new drug.");
      }
    }

    return (
      <div className={PAGE_SHELL}>
          <div>
            <PageHeader />

            <div className="flex items-center justify-between">
              <FullSearchBar
               onSearchChange={handleSearchChange}
               placeholder={"Search drugs..."}
              />

              {canManage
                ? <Button
                    onClick={() => setShowAddTab(!showAddTab)}
                    size="icon"
                    className="ml-4 rounded-full"
                    aria-label="Add a drug"
                    title="Add a drug"
                  >
                    <PlusIcon className='w-5 h-5'/>
                  </Button>
                : <p className="ml-4 shrink-0 text-sm text-muted-foreground">Read only: changing stock needs the &quot;Pharmacy stock&quot; permission.</p>}
            </div>
          </div>

          <div className={PANEL_GRID}>
            <div className={`${PANEL_WRAPPER} ${showAddTab ? "xl:col-span-8" : "xl:col-span-12"}`}>
              <DrugTable
                drugs={filteredDrugs}
                onStockCountChange={handleStockCountChange}
                onDrugNameChange={handleDrugNameChange}
                onDeleteDrug={handleDeleteDrug}
              />
            </div>

            {showAddTab && canManage && (
              <div className={`${PANEL_WRAPPER} xl:col-span-4`}>
              <AddDrugSidebar
                onSubmit={handleAddDrug}
              />
              </div>
            )}
        </div>
        {dialog}
      </div>
    )
}
