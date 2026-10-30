export interface Drug {
    id: number;
    location_id: number;
    drug_name: string;
    // On the shelf. Pending prescriptions reserve part of it.
    stock_count: number;
    reserved_count?: number;
    // stock_count - reserved_count: what can still be prescribed or dispensed.
    available_count?: number;
    last_updated_at: string;
    last_updated_by: number;
    created_at: string;
}

export interface PharmacyStats {
    total_medications: number;
    total_stock: number;
    total_reserved?: number;
    out_of_stock: number;
    low_stock: number;
}
