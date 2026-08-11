import { useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";

interface StockCountInputProps {
    count: number;
    onCountChange: (newCount: number) => void;
}

export function StockCountInput({ count, onCountChange }: StockCountInputProps) {
    const [localValue, setLocalValue] = useState(count.toString());

    useEffect(() => {
        setLocalValue(count.toString());
    }, [count]);

    const handleBlur = () => {
        const parsed = parseInt(localValue, 10);
        if (isNaN(parsed) || parsed < 0) {
            setLocalValue(count.toString());
            return;
        }
        if (parsed !== count) {
            onCountChange(parsed);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
        }
    };

    const handleIncrement = () => {
        const newCount = count + 1;
        setLocalValue(newCount.toString());
        onCountChange(newCount);
    };

    const handleDecrement = () => {
        if (count <= 0) return;
        const newCount = count - 1;
        setLocalValue(newCount.toString());
        onCountChange(newCount);
    };

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={handleDecrement}
                disabled={count <= 0}
                className="p-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Minus className="h-3 w-3" />
            </button>
            <input
                type="number"
                min="0"
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="w-20 px-2 py-1 text-center text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
                onClick={handleIncrement}
                className="p-1.5 rounded-md border border-border hover:bg-accent transition-colors"
            >
                <Plus className="h-3 w-3" />
            </button>
        </div>
    );
}
