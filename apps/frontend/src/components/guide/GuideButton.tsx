"use client";

import { useEffect, useState } from "react";
import { useGuideStore } from "@/stores/useGuideStore";
import { cn } from "@/lib/utils";

const SEEN_KEY = "veasna-guide-seen";

// The ? in the top bar: starts the guided tour (GuideTour). It pulses gently until the guide has
// been opened once on this device.
export default function GuideButton() {
  const start = useGuideStore((state) => state.start);
  const active = useGuideStore((state) => state.active);
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    try { setSeen(localStorage.getItem(SEEN_KEY) === "1"); } catch { /* storage unavailable */ }
  }, []);

  const open = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* storage unavailable */ }
    setSeen(true);
    start();
  };

  return (
    <button type="button" onClick={open} data-tour="guide-button" aria-label="Open the guide"
      title="Guide: how a patient moves through the clinic"
      className={cn(
        "group relative grid size-8 place-items-center rounded-full border border-primary/30 bg-primary/5 text-sm font-bold text-primary",
        "transition-[transform,background-color,box-shadow] duration-200 hover:scale-110 hover:bg-primary/10 hover:shadow-md active:scale-95 motion-reduce:transform-none",
        active && "bg-primary text-primary-foreground",
      )}>
      {!seen && !active && <span className="guide-ping" aria-hidden="true" />}
      <span className="transition-transform duration-300 group-hover:-rotate-12 motion-reduce:transform-none">?</span>
    </button>
  );
}
