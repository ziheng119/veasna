import { QueuedPatient } from "@/lib/types/patient";
import PatientDetails from "./PatientDetails";
import VitalsDetails from "./VitalsDetails";
import HistoryContainer from "./history/HistoryContainer";
import { PageCard } from "@/components/shared/PageCard";

interface Props {
  selectedPatient: QueuedPatient;
}

export default function PatientContainer({ selectedPatient }: Props) {
  return (
    <PageCard
      title="Patient Snapshot"
      className="xl:col-span-4"
      contentClassName="space-y-4"
    >
      <PatientDetails patient={selectedPatient} />
      <VitalsDetails patient={selectedPatient} />
      <HistoryContainer patient={selectedPatient} />
    </PageCard>
  )
}