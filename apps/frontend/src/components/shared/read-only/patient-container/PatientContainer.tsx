import { QueuedPatient } from "@/lib/types/patient";
import PatientDetails from "./PatientDetails";
import VitalsDetails from "./VitalsDetails";
import HistoryContainer from "./history/HistoryContainer";

interface Props {
  selectedPatient: QueuedPatient;
}

export default function PatientContainer({ selectedPatient }: Props) {
  return (
    <div className="flex flex-col gap-4 bg-beige-default px-4 py-2 rounded-md border-[1px] lg:w-[30%]">
      <PatientDetails patient={selectedPatient} />
      <VitalsDetails patient={selectedPatient} />
      <HistoryContainer patient={selectedPatient} />
    </div>
  )
}