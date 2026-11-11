// src/stores/useHostClockStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// The host laptop's clock as seen from this device. Tablets that have been offline often have the
// wrong date, so anything dated "today" (referrals, prints, ages) uses the host's clock instead.
interface HostClockState {
  // Host time minus this device's time, in milliseconds.
  offsetMs: number;
  // The host's timezone in minutes east of UTC; null until the host has been reached once.
  utcOffsetMinutes: number | null;
  sync: (clock: HostClock, sentAt: number, receivedAt?: number) => void;
}

// What the backend sends with /auth/me, login and /health.
export interface HostClock {
  server_time?: string;
  utc_offset_minutes?: number;
}

// Beyond this difference the device shows a warning to correct its clock.
export const CLOCK_WARNING_MS = 5 * 60 * 1000;

export const useHostClockStore = create<HostClockState>()(
  persist(
    (set) => ({
      offsetMs: 0,
      utcOffsetMinutes: null,
      sync: (clock, sentAt, receivedAt = Date.now()) => {
        const hostTime = Date.parse(clock.server_time ?? "");
        if (Number.isNaN(hostTime)) return;
        // The host read its clock roughly halfway through the request.
        const offsetMs = Math.round(hostTime - (sentAt + receivedAt) / 2);
        const utcOffsetMinutes = typeof clock.utc_offset_minutes === "number" ? clock.utc_offset_minutes : null;
        set({ offsetMs, utcOffsetMinutes });
      },
    }),
    {
      name: "host-clock",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ offsetMs, utcOffsetMinutes }) => ({ offsetMs, utcOffsetMinutes }),
    }
  )
);

const pad = (n: number) => String(n).padStart(2, "0");

// The current time on the host's clock.
export function hostNow(): Date {
  return new Date(Date.now() + useHostClockStore.getState().offsetMs);
}

// Today's date (YYYY-MM-DD) on the host's calendar: the date visits are queued under.
export function hostToday(): string {
  const { utcOffsetMinutes } = useHostClockStore.getState();
  const now = hostNow();
  if (utcOffsetMinutes === null) return isoDate(now);
  const host = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  return `${host.getUTCFullYear()}-${pad(host.getUTCMonth() + 1)}-${pad(host.getUTCDate())}`;
}

// A date on this device's calendar as YYYY-MM-DD (not UTC, which is still yesterday on a Cambodian morning).
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

