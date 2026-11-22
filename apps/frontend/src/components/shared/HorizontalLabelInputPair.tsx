interface Props {
  label: string
  bolded?: boolean
  value?: string
  readOnly?: boolean
}

export default function HorizontalLabelInputPair({ label, bolded=true, value="", readOnly=false }: Props) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row w-full h-full">
      <div className="w-fit lg:w-[250px]">
        <p className={`${bolded ? "font-semibold" : ""}`}>{label}</p>
      </div>
      <div className="w-full h-full">
        <textarea 
          className={`bg-background border border-input rounded-sm w-full h-full item p-2 text-foreground`}
          {...(readOnly
            ? { value, readOnly: true }
            : { defaultValue: value })}
        />
      </div>
    </div>
  )
}