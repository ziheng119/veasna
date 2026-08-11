import { DrugIcon } from "@/assets/icons";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

export function PageHeader() {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <DrugIcon className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-foreground">Pharmacy</h1>
      </div>
      <Link
        href="/pharmacy/dashboard"
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-md transition-colors"
      >
        <LayoutDashboard className="h-4 w-4" />
        Dashboard
      </Link>
    </div>
  );
}
