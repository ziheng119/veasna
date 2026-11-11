"use client";

import { Fragment } from "react";
import { useGuideStore } from "@/stores/useGuideStore";

// The open page, opened afresh after a tour that showed the sample patient
// (lib/guide/sample.ts), so the sample doesn't stay selected or listed once the tour ends.
export default function GuidePage({ children }: { children: React.ReactNode }) {
  const round = useGuideStore((state) => state.pageRound);
  return <Fragment key={round}>{children}</Fragment>;
}
