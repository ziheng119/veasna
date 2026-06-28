interface Props {
  label?: string
  bolded?: boolean
  value?: string
  readOnly?: boolean
  onChangeFunction?: (newValue: string) => void
}

export default function VerticalLabelInputPair({
  label,
  bolded = true,
  value = "",
  readOnly = false,
  onChangeFunction,
}: Props) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <div>
          <p className={`${bolded ? "font-semibold" : ""}`}>{label}</p>
        </div>
      )}

      <div className="flex-1 flex items-center">
        <textarea
          className="bg-background border border-input rounded-md w-full h-full p-2 text-foreground placeholder:text-muted-foreground"
          value={value}
          readOnly={readOnly}
          onChange={e => {
            if (onChangeFunction) onChangeFunction(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
