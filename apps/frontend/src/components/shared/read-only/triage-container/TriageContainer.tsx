import { QueuedPatient } from "@/lib/types/patient";
import PresentingComplaintsDetails from "./PresentingComplaintsDetails";
import SnellensTestDetails from "./SnellensTestDetails";

interface Props {
  selectedPatient: QueuedPatient
}

export default function TriageContainer({ selectedPatient }: Props) {
  return (
    <div className="bg-beige-default px-4 py-2 rounded-md border-[1px] lg:w-[40%]">
      <SnellensTestDetails patient={selectedPatient} />
      <PresentingComplaintsDetails patient={selectedPatient} />
    </div>
  )
}