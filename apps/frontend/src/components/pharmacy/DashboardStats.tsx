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
                {!!stats.total_reserved && (
                    <p className="mt-1 text-xs text-muted-foreground">{stats.total_reserved} reserved for prescriptions</p>
                )}
            </div>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-5 shadow-sm">
                <p className="text-sm text-destructive">Out of Stock</p>
                <p className="mt-1 text-3xl font-bold text-destructive">{stats.out_of_stock}</p>
            </div>
            <div className="rounded-lg border border-warning-line bg-warning-soft px-4 py-5 shadow-sm">
                <p className="text-sm text-warning-ink">Low Stock</p>
                <p className="mt-1 text-3xl font-bold text-warning-ink">{stats.low_stock}</p>
            </div>
        </div>
    );
}
