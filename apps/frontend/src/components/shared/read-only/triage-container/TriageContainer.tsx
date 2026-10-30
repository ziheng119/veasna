import { QueuedPatient } from "@/lib/types/patient";
import PresentingComplaintsDetails from "./PresentingComplaintsDetails";
import SnellensTestDetails from "./SnellensTestDetails";
import { PageCard } from "@/components/shared/PageCard";
import { COMPACT_SUMMARY_CARD, COMPACT_SUMMARY_HEADER, COMPACT_SUMMARY_CONTENT } from "@/lib/pageLayout";

interface Props {
  selectedPatient: QueuedPatient
  compact?: boolean;
}

export default function TriageContainer({ selectedPatient, compact = false }: Props) {
  return (
    <PageCard
      title="Triage Summary"
      className={compact ? COMPACT_SUMMARY_CARD : "xl:col-span-4"}
      headerClassName={compact ? COMPACT_SUMMARY_HEADER : undefined}
      contentClassName={compact ? COMPACT_SUMMARY_CONTENT : "space-y-4"}
    >
      {/* Presenting complaints matter most here; Snellen's results are secondary and collapsed. */}
      <PresentingComplaintsDetails patient={selectedPatient} />
      <SnellensTestDetails patient={selectedPatient} />
    </PageCard>
  )
}
