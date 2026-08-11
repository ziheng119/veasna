import { PharmacyStats } from "@/lib/types/drug";

interface DashboardStatsProps {
    stats: PharmacyStats;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-card px-4 py-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Total Medications</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{stats.total_medications}</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Total Stock</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{stats.total_stock}</p>
            </div>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-5 shadow-sm">
                <p className="text-sm text-destructive">Out of Stock</p>
                <p className="mt-1 text-3xl font-bold text-destructive">{stats.out_of_stock}</p>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-5 shadow-sm">
                <p className="text-sm text-amber-700">Low Stock</p>
                <p className="mt-1 text-3xl font-bold text-amber-700">{stats.low_stock}</p>
            </div>
        </div>
    );
}
