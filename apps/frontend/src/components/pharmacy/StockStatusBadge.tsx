import { Badge } from "../ui/badge";

interface StockStatusBadgeProps {
    count: number;
}

export function StockStatusBadge({ count }: StockStatusBadgeProps) {
    const getVariant = (): "destructive" | "warning" | "success" => {
        if (count === 0) return "destructive";
        if (count <= 20) return "warning";
        return "success";
    };

    const getLabel = (): string => {
        if (count === 0) return "Out of Stock";
        if (count <= 20) return "Low Stock";
        return "In Stock";
    };

    return (
        <Badge variant={getVariant()} className="inline-flex min-w-24 justify-center">
            {getLabel()}
        </Badge>
    );
}
