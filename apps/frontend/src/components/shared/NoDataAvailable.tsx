interface Props {
  dataString: string
}

export default function NoDataAvailable({ dataString }: Props) {
  return (
    <div className="flex justify-center items-center h-40 px-4 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
      No {dataString} data available for this patient's visit
    </div>
  )
}
