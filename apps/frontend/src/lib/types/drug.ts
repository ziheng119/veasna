export interface Drug {
    id: number;
    location_id: number;
    drug_name: string;
    stock_count: number;
    last_updated_at: string;
    last_updated_by: number;
    created_at: string;
}

export interface PharmacyStats {
    total_medications: number;
    total_stock: number;
    out_of_stock: number;
    low_stock: number;
}
