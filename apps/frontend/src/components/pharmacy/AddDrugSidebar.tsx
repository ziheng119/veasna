import React, { useState } from "react";

interface AddDrugSidebarProps {
  onSubmit: (newDrug: { drug_name: string; stock_count: number }) => void;
}

export function AddDrugSidebar({ onSubmit }: AddDrugSidebarProps) {
  const [drugName, setDrugName] = useState("");
  const [stockCount, setStockCount] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!drugName.trim()) {
      alert("Please enter a drug name");
      return;
    }

    onSubmit({
      drug_name: drugName.trim(),
      stock_count: Math.max(0, stockCount),
    });

    setDrugName("");
    setStockCount(0);
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
          <label htmlFor="stockCount" className="block text-sm font-medium text-gray-700 mb-1">
            Initial Stock Count
          </label>
          <input
            type="number"
            id="stockCount"
            min="0"
            value={stockCount}
            onChange={(e) => setStockCount(parseInt(e.target.value, 10) || 0)}
            className="w-full px-3 py-2 border border-gray-300 text-black bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0"
          />
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
