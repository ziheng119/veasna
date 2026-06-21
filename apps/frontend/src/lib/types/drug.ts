export interface Drug {
    id: number;
    location_id: number;
    drug_name: string;
    stock_level: "low" | "medium" | "high" | "no stock";
    last_updated_at: string;
    last_updated_by: number;
    created_at: string;
  }

export interface Stats {
    total: number
    low: number
    medium: number
    high: number
}
  