import { DrugIcon } from "@/assets/icons"
import { Drug } from "@/lib/types/drug"
import { DrugTableRow } from "./DrugTableRow"
import { useMemo } from "react"

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between ">
            
              {/* Table Header */}
              <h2 className="text-xl font-bold text-gray-900">
                Drug Inventory
              </h2>

              {/* Overal Inventory Statistics */}
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-gray-600">
                  Total: <span className="font-semibold">{drugs.length}</span>
                </span>
                <span className="text-red-500">
                  No Stock: <span className="font-semibold">{stockCounts["no stock"] || 0}</span>
                </span>
                <span className="text-yellow-500">
                  Low: <span className="font-semibold">{stockCounts.low || 0}</span>
                </span>
                <span className="text-blue-500">
                  Medium: <span className="font-semibold">{stockCounts.medium || 0}</span>
                </span>
                <span className="text-green-500">
                  High: <span className="font-semibold">{stockCounts.high || 0}</span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-gray-100">
                <tr>
                  <th className="w-1/4 px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Drug Name
                  </th>
                  <th className="w-1/4 px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Stock Level
                  </th>
                  <th className="w-1/4 px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
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
                <DrugIcon className="mx-auto h-16 w-16 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No drugs found</h3>
                <p className="mt-2 text-gray-500">
                  Try adjusting your search criteria or check your spelling.
                </p>
              </div>
            )}
          </div>
        </div>
      )
  }