import { DrugIcon } from "@/assets/icons"
import { Drug } from "@/lib/types/drug"
import { DrugTableRow } from "./DrugTableRow"
import { useMemo } from "react"
import { PageCard } from "../shared/PageCard"

interface DrugTableProps {
    drugs: Drug[]
    onStockLevelChange: (drugId: number, newLevel: "low" | "medium" | "high" | "no stock") => void
    onDeleteDrug: (drugId: number) => void
}


export function DrugTable({ drugs, onStockLevelChange, onDeleteDrug}: DrugTableProps) {

    const stockCounts = useMemo(() => {
        return drugs.reduce((acc, drug) => {
          acc[drug.stock_level] = (acc[drug.stock_level] || 0) + 1
          return acc
        }, {} as Record<"low" | "medium" | "high" | "no stock", number>)
      }, [drugs])

    return (
        <PageCard
          title="Drug Inventory"
          className="overflow-hidden"
          contentClassName="px-0"
          headerExtra={
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold text-foreground">{drugs.length}</p>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm">
                <p className="text-xs text-destructive">No Stock</p>
                <p className="font-semibold text-destructive">{stockCounts["no stock"] || 0}</p>
              </div>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <p className="text-xs text-amber-700">Low</p>
                <p className="font-semibold text-amber-700">{stockCounts.low || 0}</p>
              </div>
              <div className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm">
                <p className="text-xs text-sky-700">Medium</p>
                <p className="font-semibold text-sky-700">{stockCounts.medium || 0}</p>
              </div>
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm">
                <p className="text-xs text-emerald-700">High</p>
                <p className="font-semibold text-emerald-700">{stockCounts.high || 0}</p>
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-muted">
                <tr>
                  <th className="w-1/4 px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Drug Name
                  </th>
                  <th className="w-1/4 px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Stock Level
                  </th>
                  <th className="w-1/4 px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {drugs.map((drug) => (
                  <DrugTableRow 
                    key={drug.id}
                    drug={drug}
                    onStockLevelChange={onStockLevelChange}
                    onDeleteDrug={onDeleteDrug}
                  />
                ))}
              </tbody>
            </table>
            
            {drugs.length === 0 && (
              <div className="text-center py-12">
                <DrugIcon className="mx-auto h-16 w-16 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium text-foreground">No drugs found</h3>
                <p className="mt-2 text-muted-foreground">
                  Try adjusting your search criteria or check your spelling.
                </p>
              </div>
            )}
          </div>
        </PageCard>
      )
  }