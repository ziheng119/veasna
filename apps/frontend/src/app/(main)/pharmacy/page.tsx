"use client"

import React, { useEffect, useState } from "react"
import { Drug, PharmacyStats } from "@/lib/types/drug"
import { getDrugsByLocation, getPharmacyStats, dispenseDrug } from "@/lib/api/pharmacy/pharmacy"
import { useLocationStore } from "@/stores/useLocationStore"
import { useRealtimeStore } from "@/stores/useRealtimeStore"
import { DashboardStats } from "@/components/pharmacy/DashboardStats"
import { StockStatusBadge } from "@/components/pharmacy/StockStatusBadge"
import { DispenseForm } from "@/components/pharmacy/DispenseForm"
import { DrugIcon } from "@/assets/icons"
import { PageCard } from "@/components/shared/PageCard"
import Link from "next/link"
import { Settings } from "lucide-react"
import toast from "react-hot-toast"
import { SET_LOCATION_MESSAGE } from "@/messages/info"
import { PAGE_SHELL, PANEL_GRID, PANEL_WRAPPER } from "@/lib/pageLayout";
import { Tabs, TabsContent } from "@/components/ui/tabs"
import SegmentedTabs from "@/components/shared/SegmentedTabs"
import PendingPrescriptions from "@/components/pharmacy/PendingPrescriptions"
import PatientPrescriptionHistory from "@/components/pharmacy/PatientPrescriptionHistory"
import { Boxes, ClipboardList, Users } from "lucide-react"

// Prescriptions waiting to be dispensed come first: they are the pharmacy's main queue.
const PHARMACY_TABS = [
  { value: "prescriptions", label: "Prescriptions to dispense", icon: ClipboardList },
  { value: "inventory", label: "Inventory", icon: Boxes },
  { value: "patients", label: "Patients", icon: Users },
]

export default function Pharmacy() {
    const [drugs, setDrugs] = useState<Drug[]>([])
    const [stats, setStats] = useState<PharmacyStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [tab, setTab] = useState("prescriptions")

    const location = useLocationStore((state) => state.currentLocation)
    // Prescribing elsewhere changes available stock; reload when another device makes a change.
    const revision = useRealtimeStore((state) => state.revision)

    useEffect(() => {
      if (!location) {
        toast(SET_LOCATION_MESSAGE);
      }
    }, [location]);

    async function fetchData() {
      if (!location) return;
      try {
        const [drugsData, statsData] = await Promise.all([
          getDrugsByLocation(location.id),
          getPharmacyStats(location.id),
        ]);
        setDrugs(drugsData);
        setStats(statsData);
      } catch (error) {
        toast.error("Failed to load pharmacy data.");
      } finally {
        setIsLoading(false);
      }
    }

    useEffect(() => {
      fetchData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, revision]);

    const handleDispense = async (drugId: number, quantity: number) => {
      const drug = drugs.find(d => d.id === drugId);
      if (!drug) return;

      try {
        const updatedDrug = await dispenseDrug(drugId, quantity);
        setDrugs(prev => prev.map(d => d.id === drugId ? updatedDrug : d));
        if (stats && location) {
          const newStats = await getPharmacyStats(location.id);
          setStats(newStats);
        }
        toast.success(`Dispensed ${quantity}x ${drug.drug_name}. ${updatedDrug.available_count ?? updatedDrug.stock_count} available.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to dispense medication.");
        // Stock may have changed on another device; show the current counts.
        void fetchData();
      }
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return (
      <div className={PAGE_SHELL}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DrugIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-foreground">Pharmacy</h1>
          </div>
          <Link
            href="/pharmacy/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-md transition-colors"
          >
            <Settings className="h-4 w-4" />
            Manage Inventory
          </Link>
        </div>

        {stats && <DashboardStats stats={stats} />}

        <Tabs value={tab} onValueChange={setTab} className="gap-4 xl:min-h-0 xl:flex-1">
          <SegmentedTabs tabs={PHARMACY_TABS} value={tab} label="Pharmacy sections" />

          <TabsContent value="prescriptions" className="mt-0">
            <PageCard title="Prescriptions to dispense" contentClassName="px-0">
              {location
                ? <PendingPrescriptions locationId={location.id} onStockChanged={() => void fetchData()} />
                : <p className="px-6 text-sm text-muted-foreground">Select a location.</p>}
            </PageCard>
          </TabsContent>

          <TabsContent value="inventory" className="mt-0 xl:min-h-0">
            <div className={PANEL_GRID}>
              {/* Medication Table */}
              <div className={`${PANEL_WRAPPER} xl:col-span-8`}>
                <PageCard
                  title="All Medications"
                  className="overflow-hidden"
                  contentClassName="px-0"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Drug Name
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            In Stock
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider" title="Held by prescriptions waiting to be dispensed">
                            Reserved
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider" title="In stock minus reserved: what can still be prescribed">
                            Available
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            Last Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-card divide-y divide-border">
                        {drugs.map((drug) => (
                          <tr key={drug.id} className="hover:bg-accent/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-foreground">
                              {drug.drug_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground tabular-nums">
                              {drug.stock_count}
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground tabular-nums">
                              {drug.reserved_count ?? 0}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-foreground tabular-nums">
                              {drug.available_count ?? drug.stock_count}
                            </td>
                            <td className="px-6 py-4">
                              <StockStatusBadge count={drug.available_count ?? drug.stock_count} />
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {formatDate(drug.last_updated_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {drugs.length === 0 && !isLoading && (
                      <div className="text-center py-12">
                        <DrugIcon className="mx-auto h-16 w-16 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-medium text-foreground">No medications</h3>
                        <p className="mt-2 text-muted-foreground">
                          Add medications from the{" "}
                          <Link href="/pharmacy/dashboard" className="text-primary underline">
                            inventory management
                          </Link>{" "}
                          page.
                        </p>
                      </div>
                    )}
                  </div>
                </PageCard>
              </div>

              {/* Dispense Sidebar */}
              <div className={`${PANEL_WRAPPER} xl:col-span-4`}>
                <PageCard title="Dispense Medication">
                  <DispenseForm drugs={drugs} onDispense={handleDispense} />
                </PageCard>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="patients" className="mt-0">
            <PageCard title="Patients: prescribed and dispensed" contentClassName="px-0">
              {location
                ? <PatientPrescriptionHistory locationId={location.id} />
                : <p className="px-6 text-sm text-muted-foreground">Select a location.</p>}
            </PageCard>
          </TabsContent>
        </Tabs>
      </div>
    )
}
