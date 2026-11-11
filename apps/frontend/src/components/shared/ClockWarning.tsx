"use client";

import { CLOCK_WARNING_MS, useHostClockStore } from "@/stores/useHostClockStore";

// "3 days", "2 hours", "12 minutes": how far off this device's clock is.
export function clockDifferenceText(ms: number): string {
  const minutes = Math.round(Math.abs(ms) / 60_000);
  const [amount, unit] = minutes >= 2 * 24 * 60 ? [Math.round(minutes / (24 * 60)), "day"]
    : minutes >= 120 ? [Math.round(minutes / 60), "hour"] : [minutes, "minute"];
  return `${amount} ${unit}${amount === 1 ? "" : "s"}`;
}

/** Warns when this device's clock is well off the host laptop's (VEASNA dates records by the host's). */
export default function ClockWarning() {
  const offsetMs = useHostClockStore(state => state.offsetMs);
  if (Math.abs(offsetMs) < CLOCK_WARNING_MS) return null;
  // A positive offset means the host is ahead, so this device is behind.
  const direction = offsetMs > 0 ? "behind" : "ahead of";
  return (
    <div role="alert" className="border-b border-amber-300 bg-amber-50 px-6 py-1 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
      This device&apos;s clock is {clockDifferenceText(offsetMs)} {direction} the host laptop. VEASNA uses the host&apos;s date,
      but please correct this device&apos;s date and time.
    </div>
  );
}
