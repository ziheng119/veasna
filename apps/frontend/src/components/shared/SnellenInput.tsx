"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SNELLEN_OPTIONS } from "@/lib/snellen"
import { cn } from "@/lib/utils"

// Radix Select items cannot have an empty value, so "not chosen" needs a stand-in.
const UNSET = "unset"

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
}

// Dropdown for a Snellen fraction. Shows "Please select" until a reading is chosen.
export default function SnellenInput({ value, onChange, className }: Props) {
  // Keep a previously saved reading selectable even if it is not a standard chart line.
  const options = value && !SNELLEN_OPTIONS.includes(value) ? [value, ...SNELLEN_OPTIONS] : SNELLEN_OPTIONS

  return (
    <Select value={value || UNSET} onValueChange={(next) => onChange(next === UNSET ? "" : next)}>
      <SelectTrigger className={cn("w-full", className)}>
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
