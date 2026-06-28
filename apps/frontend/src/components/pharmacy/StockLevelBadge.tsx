import { Badge } from "../ui/badge";

interface StockLevelBadgeProps {
    level: "low" | "medium" | "high" | "no stock"
}

export function StockLevelBadge({ level }: StockLevelBadgeProps) {
    const getStockLevelVariant = (level: "low" | "medium" | "high" | "no stock"): "warning" | "info" | "success" | "destructive" => {
      switch (level) {
        case "low": return "warning"
        case "medium": return "info"
        case "high": return "success"
        case "no stock": return "destructive"
        default: return "info"
      }
    }
  
    return (
      <Badge variant={getStockLevelVariant(level)} className="inline-flex min-w-24 justify-center">
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    )
}