import { Drug } from "@/lib/types/drug"
import { StockStatusBadge } from "./StockStatusBadge"
import { StockCountInput } from "./StockCountInput"
import { TrashIcon, EditIcon } from "@/assets/icons"
import { useState } from "react"
import { Check, X } from "lucide-react"

interface DrugTableRowProps {
    drug: Drug
    onStockCountChange: (drugId: number, newCount: number) => void
    onDrugNameChange: (drugId: number, newName: string) => void
    onDeleteDrug: (drugId: number) => void
}

export function DrugTableRow({ drug, onStockCountChange, onDrugNameChange, onDeleteDrug }: DrugTableRowProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(drug.drug_name);

    const handleSaveName = () => {
        const trimmed = editedName.trim();
        if (trimmed && trimmed !== drug.drug_name) {
            onDrugNameChange(drug.id, trimmed);
        } else {
            setEditedName(drug.drug_name);
        }
        setIsEditingName(false);
    };

    const handleCancelEdit = () => {
        setEditedName(drug.drug_name);
        setIsEditingName(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSaveName();
        if (e.key === "Escape") handleCancelEdit();
    };

    return (
        <tr className="group hover:bg-accent/50 transition-colors duration-150">
          <td className="px-6 py-4">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button onClick={handleSaveName} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={handleCancelEdit} className="p-1 text-muted-foreground hover:bg-muted rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{drug.drug_name}</span>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <EditIcon className="h-3 w-3" />
                </button>
              </div>
            )}
          </td>
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground w-12">{drug.stock_count ?? 0}</span>
              <StockStatusBadge count={drug.stock_count ?? 0} />
            </div>
          </td>
          <td className="px-6 py-4">
            <StockCountInput
              count={drug.stock_count}
              onCountChange={(newCount) => onStockCountChange(drug.id, newCount)}
            />
          </td>
          <td className="px-6 py-4">
            <button
              onClick={() => onDeleteDrug(drug.id)}
              className="p-2 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-1"
              title={`Delete ${drug.drug_name}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </td>
        </tr>
    )
}
