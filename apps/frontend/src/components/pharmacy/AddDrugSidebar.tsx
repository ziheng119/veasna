import React, { useState } from "react";
import { Drug } from "@/lib/types/drug";
import { StockLevelSelector } from "./StockLevelSelector";
import { StockLevelBadge } from "./StockLevelBadge";

interface AddDrugSidebarProps {
  onSubmit: (newDrug: { drug_name: string, stock_level: Drug['stock_level'] }) => void;
}

export function AddDrugSidebar({ onSubmit }: AddDrugSidebarProps) {
  const [drugName, setDrugName] = useState("");
  const [stockLevel, setStockLevel] = useState<Drug['stock_level']>("high");

  // The StockLevelSelector passes a dummy ID which we ignore here
  const handleStockLevelChange = (_drugId: number | string, newLevel: Drug['stock_level']) => {
    setStockLevel(newLevel);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!drugName.trim()) {
      alert("Please enter a drug name");
      return;
    }

    // Pass the raw form data to the parent component for submission
    onSubmit({
      drug_name: drugName.trim(),
      stock_level: stockLevel
    });
    
    // Reset form fields after submission
    setDrugName("");
    setStockLevel("high");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Add New Drug</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="drugName" className="block text-sm font-medium text-gray-700 mb-1">
            Drug Name *
          </label>
          <input
            type="text"
            id="drugName"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 text-black bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Paracetamol"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Level
          </label>
          <div className="flex items-center gap-3">
            <StockLevelBadge level={stockLevel} />
            <div className="flex-1">
              <StockLevelSelector
                currentLevel={stockLevel}
                drugId={0} // Dummy ID, not used for a new drug
                onStockLevelChange={handleStockLevelChange}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors font-medium shadow-sm"
          >
            Add Drug
          </button>
        </div>
      </form>
    </div>
  );
}