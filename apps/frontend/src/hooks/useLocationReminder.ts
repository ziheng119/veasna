import { useEffect } from "react";
import toast from "react-hot-toast";
import { SET_LOCATION_MESSAGE } from "@/messages/info";
import { useLocationStore } from "@/stores/useLocationStore";
import { useGuideStore } from "@/stores/useGuideStore";

// One id for the reminder, so it is shown once however many pages ask (moving between pages, or
// React running effects twice in development, updates the same toast instead of stacking more).
export const LOCATION_REMINDER_ID = "set-location";

// Pages that show one location's patients ask for a location when none is chosen. Not during the
// guided tour, which lends one.
export function useLocationReminder() {
  const missing = useLocationStore((state) => !state.currentLocation);
  const touring = useGuideStore((state) => state.active);
  useEffect(() => {
    if (missing && !touring) toast(SET_LOCATION_MESSAGE, { id: LOCATION_REMINDER_ID });
  }, [missing, touring]);
}
