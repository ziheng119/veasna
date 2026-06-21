import { DrugIcon } from "@/assets/icons"

// Page Header Component
export function PageHeader() {
    return (
      <div className="flex items-center gap-3 mb-4">
        <DrugIcon className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Pharmacy</h1>
      </div>
    )
}