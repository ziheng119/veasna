"use client"

import React, { useEffect, useState } from "react"
import { Drug, PharmacyStats } from "@/lib/types/drug"
import { QueuedPatient } from "@/lib/types/patient"
import { getDrugsByLocation, getPharmacyStats, dispenseDrug } from "@/lib/api/pharmacy/pharmacy"
import { getQueue } from "@/lib/api/queue/getQueue"
import { useLocationStore } from "@/stores/useLocationStore"
import { useUserStore } from "@/stores/useUserStore"
import { DashboardStats } from "@/components/pharmacy/DashboardStats"
import { StockStatusBadge } from "@/components/pharmacy/StockStatusBadge"
import { DispenseForm } from "@/components/pharmacy/DispenseForm"
import { DrugIcon } from "@/assets/icons"
import { PageCard } from "@/components/shared/PageCard"
import Link from "next/link"
import { Settings } from "lucide-react"
import toast from "react-hot-toast"
import { SET_LOCATION_MESSAGE } from "@/messages/info"

export default function Pharmacy() {
    const [drugs, setDrugs] = useState<Drug[]>([])
    const [stats, setStats] = useState<PharmacyStats | null>(null)
    const [queuePatients, setQueuePatients] = useState<QueuedPatient[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const location = useLocationStore((state) => state.currentLocation)
    const token = useUserStore((state) => state.user?.token)

    useEffect(() => {
      if (!location) {
        toast(SET_LOCATION_MESSAGE);
      }
    }, [location]);

    async function fetchData() {
      if (!location) return;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [drugsData, statsData, queueData] = await Promise.all([
          getDrugsByLocation(location.id),
          getPharmacyStats(location.id),
          token ? getQueue(location.id, today, token) : Promise.resolve([]),
        ]);
        setDrugs(drugsData);
        setStats(statsData);
        setQueuePatients(Array.isArray(queueData) ? queueData : []);
      } catch (error) {
        toast.error("Failed to load pharmacy data.");
      } finally {
        setIsLoading(false);
      }
    }

    useEffect(() => {
      fetchData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location, token]);

    const handleDispense = async (drugId: number, quantity: number, visitId?: number) => {
      const drug = drugs.find(d => d.id === drugId);
      if (!drug) return;

      try {
        const updatedDrug = await dispenseDrug(drugId, quantity, { visitId, locationId: location?.id });
        setDrugs(prev => prev.map(d => d.id === drugId ? updatedDrug : d));
        if (stats && location) {
          const newStats = await getPharmacyStats(location.id);
          setStats(newStats);
        }
        toast.success(`Dispensed ${quantity}x ${drug.drug_name}. ${updatedDrug.stock_count} remaining.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to dispense medication.");
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
      <div className="space-y-6">
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Medication Table */}
          <div className="xl:col-span-8">
            <PageCard
              title="All Medications"
              className="overflow-hidden"
              contentClassName="px-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Drug Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Count
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
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">
                          {drug.stock_count}
                        </td>
                        <td className="px-6 py-4">
                          <StockStatusBadge count={drug.stock_count} />
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
          <div className="xl:col-span-4">
            <PageCard title="Dispense Medication">
              <DispenseForm drugs={drugs} patients={queuePatients} onDispense={handleDispense} />
            </PageCard>
          </div>
        </div>
      </div>
    )
}
