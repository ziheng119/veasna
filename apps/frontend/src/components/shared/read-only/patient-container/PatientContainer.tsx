import { QueuedPatient } from "@/lib/types/patient";
import PatientDetails from "./PatientDetails";
import VitalsDetails from "./VitalsDetails";
import HistoryContainer from "./history/HistoryContainer";
import { PageCard } from "@/components/shared/PageCard";
import { COMPACT_SUMMARY_CARD, COMPACT_SUMMARY_HEADER, COMPACT_SUMMARY_CONTENT } from "@/lib/pageLayout";

interface Props {
  selectedPatient: QueuedPatient;
  compact?: boolean;
}

export default function PatientContainer({ selectedPatient, compact = false }: Props) {
  return (
    <PageCard
      title="Patient Snapshot"
      className={compact ? COMPACT_SUMMARY_CARD : "xl:col-span-4"}
      headerClassName={compact ? COMPACT_SUMMARY_HEADER : undefined}
      contentClassName={compact ? COMPACT_SUMMARY_CONTENT : "space-y-4"}
    >
      <PatientDetails patient={selectedPatient} />
      <VitalsDetails patient={selectedPatient} />
      <HistoryContainer patient={selectedPatient} />
    </PageCard>
  )
}
