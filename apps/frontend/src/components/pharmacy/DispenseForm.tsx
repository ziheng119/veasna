"use client"

import { useState } from "react"
import { Drug } from "@/lib/types/drug"
import { StockStatusBadge } from "./StockStatusBadge"

interface DispenseFormProps {
    drugs: Drug[]
    onDispense: (drugId: number, quantity: number) => void
}

// Stock reserved by pending prescriptions cannot be dispensed here.
const available = (drug: Drug) => drug.available_count ?? drug.stock_count

export function DispenseForm({ drugs, onDispense }: DispenseFormProps) {
    const [selectedDrugId, setSelectedDrugId] = useState<number | null>(null)
    const [quantity, setQuantity] = useState(1)

    const selectedDrug = drugs.find(d => d.id === selectedDrugId) ?? null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedDrugId || quantity <= 0) return
        if (selectedDrug && quantity > available(selectedDrug)) return
        onDispense(selectedDrugId, quantity)
        setQuantity(1)
    }

    const maxQuantity = selectedDrug ? available(selectedDrug) : 0

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="dispense-drug" className="block text-sm font-medium text-foreground mb-1">
                    Medication
                </label>
                <select
                    id="dispense-drug"
                    value={selectedDrugId ?? ""}
                    onChange={(e) => {
                        setSelectedDrugId(e.target.value ? parseInt(e.target.value, 10) : null)
                        setQuantity(1)
                    }}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                    <option value="">Select a medication...</option>
                    {drugs.map(drug => (
                        <option key={drug.id} value={drug.id} disabled={available(drug) <= 0}>
                            {drug.drug_name} ({available(drug)} available)
                        </option>
                    ))}
                </select>
            </div>

            {selectedDrug && (
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
                    <span className="text-sm text-muted-foreground">Available:</span>
                    <span className="text-sm font-semibold">{available(selectedDrug)}</span>
                    <StockStatusBadge count={available(selectedDrug)} />
                </div>
            )}

            <div>
                <label htmlFor="dispense-qty" className="block text-sm font-medium text-foreground mb-1">
                    Quantity to Dispense
                </label>
                <input
                    id="dispense-qty"
                    type="number"
                    min="1"
                    max={maxQuantity}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                    disabled={!selectedDrug || available(selectedDrug) <= 0}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                {selectedDrug && quantity > maxQuantity && (
                    <p className="mt-1 text-xs text-destructive">
                        Cannot dispense more than available stock ({maxQuantity}); the rest is reserved for prescriptions
                    </p>
                )}
            </div>

            {selectedDrug && quantity > 0 && quantity <= maxQuantity && (
                <div className="text-sm text-muted-foreground">
                    After dispensing: <span className="font-semibold text-foreground">{available(selectedDrug) - quantity}</span> available
                </div>
            )}

            <button
                type="submit"
                disabled={!selectedDrug || quantity <= 0 || quantity > maxQuantity}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Dispense
            </button>
        </form>
    )
}
