import HorizontalLabelInputPair from "../shared/HorizontalLabelInputPair"
import SaveButton from "../shared/SaveButton"

export default function History() {
  return (
    <div>
      <div className="flex flex-col gap-y-4 h-[70vh]">
        <HorizontalLabelInputPair 
          label="Past History"
        />
        <HorizontalLabelInputPair 
          label="Drug and Treatment History"
        />
        <HorizontalLabelInputPair 
          label="Family History"
        />
        <HorizontalLabelInputPair 
          label="Social History"
        />
      </div>
      <div className="flex items-end justify-end">
        <SaveButton />
      </div>
    </div>
  )
}