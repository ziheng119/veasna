import HorizontalLabelInputPair from "../shared/HorizontalLabelInputPair";
import SaveButton from "../shared/SaveButton";

export default function PresentingComplaints() {
  return (
    <div>
      <div className="flex flex-col gap-2 h-[70vh] items-stretch">
        <HorizontalLabelInputPair 
          label="History of Presenting Symptoms"
        />
        <HorizontalLabelInputPair 
          label="Red Flags"
        />
        <HorizontalLabelInputPair 
          label="Systems Review"
        />
        <HorizontalLabelInputPair 
          label="Drug Allergies"
        />
      </div>
      <div className="flex items-end justify-end">
        <SaveButton />
      </div>
    </div>

  )
}