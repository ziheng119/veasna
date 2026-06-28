import { QueuedPatient } from "@/lib/types/patient";
import PresentingComplaintsDetails from "./PresentingComplaintsDetails";
import SnellensTestDetails from "./SnellensTestDetails";
import { PageCard } from "@/components/shared/PageCard";

interface Props {
  selectedPatient: QueuedPatient
}

export default function TriageContainer({ selectedPatient }: Props) {
  return (
    <PageCard
      title="Triage Summary"
      className="xl:col-span-4"
      contentClassName="space-y-4"
    >
      <SnellensTestDetails patient={selectedPatient} />
      <PresentingComplaintsDetails patient={selectedPatient} />
    </PageCard>
  )
}