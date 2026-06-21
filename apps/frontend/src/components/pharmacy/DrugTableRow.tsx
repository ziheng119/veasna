import { Drug } from "@/lib/types/drug"
import { StockLevelBadge } from "./StockLevelBadge"
import { StockLevelSelector } from "./StockLevelSelector"
import { TrashIcon } from "@/assets/icons"

interface DrugTableRowProps {
    drug: Drug
    onStockLevelChange: (drugId: number, newLevel: "low" | "medium" | "high" | "no stock") => void
    onDeleteDrug: (drugId: number) => void
}

export function DrugTableRow({ drug, onStockLevelChange, onDeleteDrug }: DrugTableRowProps) {
    return (
        <tr className="hover:bg-blue-50 transition-colors duration-150">
          <td className="px-6 py-4">
            <div className="text-sm font-medium text-gray-900">
              {drug.drug_name}
            </div>
          </td>
          <td className="px-6 py-4">
            <StockLevelBadge level={drug.stock_level} />
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center space-x-3">
                <StockLevelSelector 
                currentLevel={drug.stock_level}
                drugId={drug.id}
                onStockLevelChange={onStockLevelChange}
                />
                <button
                    onClick={() => onDeleteDrug(drug.id)}
                    className="
                    p-2 text-red-500 hover:text-red-700 hover:bg-red-50 
                    rounded-md transition-colors duration-150
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1
                    "
                    title={`Delete ${drug.drug_name}`}
                >
                    <TrashIcon className="h-4 w-4" />
                </button>
            </div>
          </td>
        </tr>
      )
}