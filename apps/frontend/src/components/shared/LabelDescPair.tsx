interface Props {
  label: string
  description: string
}

export default function LabelDescriptionPair({ label, description }: Props) {
  return (
    <div className="flex flex-col lg:flex-row lg:gap-4 justify-between">
      <div>
        <p>{label}</p>
      </div>
      <div>
        <p>{description}</p>
      </div>
    </div>
  )
}