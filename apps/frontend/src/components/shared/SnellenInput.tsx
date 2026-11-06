"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFormOptions } from "@/stores/useFormOptionsStore"
import { cn } from "@/lib/utils"

// Radix Select items cannot have an empty value, so "not chosen" needs a stand-in.
const UNSET = "unset"

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
  "aria-label"?: string
}

// Dropdown for a Snellen fraction. Shows "Please select" until a reading is chosen.
export default function SnellenInput({ value, onChange, className, "aria-label": ariaLabel }: Props) {
  // Chart lines from the Station data page. Keep a previously saved reading selectable even if it
  // is not on the current list.
  const listed = useFormOptions("snellen").map((option) => option.label)
  const options = value && !listed.includes(value) ? [value, ...listed] : listed

  return (
    <Select value={value || UNSET} onValueChange={(next) => onChange(next === UNSET ? "" : next)}>
      <SelectTrigger className={cn("w-full", className)} aria-label={ariaLabel}>
        <SelectValue placeholder="Please select" />
      </SelectTrigger>
      {/* Always open downwards; when space below is short the list scrolls instead of flipping up. */}
      <SelectContent side="bottom" avoidCollisions={false} className="bg-popover border-border">
        <SelectItem value={UNSET}>Please select</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
