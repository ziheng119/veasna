import { DrugIcon } from "@/assets/icons"
import { Drug } from "@/lib/types/drug"
import { DrugTableRow } from "./DrugTableRow"
import { useMemo } from "react"
import { PageCard } from "../shared/PageCard"

interface DrugTableProps {
    drugs: Drug[]
    onStockCountChange: (drugId: number, newCount: number) => void
    onDrugNameChange: (drugId: number, newName: string) => void
    onDeleteDrug: (drugId: number) => void
}


export function DrugTable({ drugs, onStockCountChange, onDrugNameChange, onDeleteDrug }: DrugTableProps) {

    const stats = useMemo(() => {
        const outOfStock = drugs.filter(d => d.stock_count === 0).length;
        const lowStock = drugs.filter(d => d.stock_count > 0 && d.stock_count <= 20).length;
        const totalStock = drugs.reduce((sum, d) => sum + d.stock_count, 0);
        return { outOfStock, lowStock, totalStock };
    }, [drugs]);

    return (
        <PageCard
          title="Drug Inventory"
          className="overflow-hidden"
          contentClassName="px-0"
          headerExtra={
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Total Items</p>
                <p className="font-semibold text-foreground">{drugs.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">Total Stock</p>
                <p className="font-semibold text-foreground">{stats.totalStock}</p>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm">
                <p className="text-xs text-destructive">Out of Stock</p>
                <p className="font-semibold text-destructive">{stats.outOfStock}</p>
              </div>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <p className="text-xs text-amber-700">Low Stock</p>
                <p className="font-semibold text-amber-700">{stats.lowStock}</p>
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
                    Stock
                  </th>
                  <th className="w-1/4 px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Edit Count
                  </th>
                  <th className="w-[100px] px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {drugs.map((drug) => (
                  <DrugTableRow
                    key={drug.id}
                    drug={drug}
                    onStockCountChange={onStockCountChange}
                    onDrugNameChange={onDrugNameChange}
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
