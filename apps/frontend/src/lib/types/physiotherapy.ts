export interface PainPoint {
    xCoord: number;
    yCoord: number;
}

export interface Physiotherapy {
    notes?: string;
    painpoints: PainPoint[]; // A list of coordinates marked on a diagram
}