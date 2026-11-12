"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import { clearQueueCache } from "@/lib/api/queue/getQueue";
import { clearPatientListCache } from "@/lib/api/patients/getPatientList";

// Lists reload this long after a change, plus a random part of the spread, so devices told at the
// same moment don't all ask the host at once.
const REFRESH_DELAY_MS = 100;
const REFRESH_SPREAD_MS = 400;

export default function RealtimeConnection() {
  const token = useUserStore(state => state.user?.token);
  const status = useRealtimeStore(state => state.status);
  const offlineSince = useRealtimeStore(state => state.offlineSince);

  useEffect(() => {
    if (!token) return;
    const { invalidate, noteVisitChanges, setStatus } = useRealtimeStore.getState();
    setStatus("connecting");
    const socket = io(backend_url, { auth: { token }, transports: ["websocket", "polling"], tryAllTransports: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Visits saved since the last refresh; null once any visit may have changed.
    let changed: Set<number> | null = new Set();
    // `visitId` is the visit a save changed (null when unknown; omitted on reconnect).
    const refresh = (visitId: number | null = null) => {
      if (changed) {
        if (typeof visitId === "number") changed.add(visitId);
        else changed = null;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        clearQueueCache();
        clearPatientListCache();
        invalidate();
        noteVisitChanges(changed && Array.from(changed));
        changed = new Set();
      }, REFRESH_DELAY_MS + Math.random() * REFRESH_SPREAD_MS);
    };
    socket.on("connect", () => {
      setStatus("live");
      // Always reload after reconnect: notifications during an outage can be missed.
      refresh();
    });
    socket.on("lists:changed", (notice?: { visitId?: number | null }) => refresh(notice?.visitId ?? null));
    socket.on("disconnect", (reason) => {
      setStatus("offline");
      if (reason === "io server disconnect") useUserStore.getState().removeUser();
    });
    socket.on("connect_error", (error) => {
      setStatus("offline");
      if (error.message === "Authentication required") useUserStore.getState().removeUser();
    });
    const resume = () => {
      if (document.visibilityState === "visible") {
        if (!socket.connected) socket.connect();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      socket.removeAllListeners();
      socket.disconnect();
      setStatus("offline");
    };
  }, [token]);

  if (status !== "offline") {
    return (
      <div role="status" data-tour="connection" className="px-6 py-1 text-xs text-muted-foreground bg-card border-b">
        {status === "live" ? "Live queue, patient list and form updates" : "Connecting to live updates…"}
      </div>
    );
  }
  // The host can't be reached (weak Wi-Fi, or the host is restarting). What still works, so staff
  // can carry on: typing is kept as a draft, and everything reloads once the host answers again.
  const since = offlineSince === null ? "" : ` since ${new Date(offlineSince).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return (
    <div role="status" data-tour="connection" className="px-6 py-1 text-xs border-b border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
      Can&apos;t reach the host laptop{since}. Lists may be out of date. What you type is kept on this
      device; save once this bar is back to normal. Reconnecting by itself; avoid reloading the page.
    </div>
  );
}
