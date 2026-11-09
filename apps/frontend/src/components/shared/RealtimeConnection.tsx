"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { useRealtimeStore } from "@/stores/useRealtimeStore";
import { clearQueueCache } from "@/lib/api/queue/getQueue";
import { clearPatientsByLocationCache } from "@/lib/api/patients/getPatientsByLocation";

export default function RealtimeConnection() {
  const token = useUserStore(state => state.user?.token);
  const status = useRealtimeStore(state => state.status);

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
        clearPatientsByLocationCache();
        invalidate();
        noteVisitChanges(changed && Array.from(changed));
        changed = new Set();
      }, 100);
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

  return (
    <div role="status" className="px-6 py-1 text-xs text-muted-foreground bg-card border-b">
      {status === "live" ? "Live queue, patient list and form updates" : status === "connecting"
        ? "Connecting to live updates…" : "Live updates disconnected — lists may be out of date. Reconnecting…"}
    </div>
  );
}
