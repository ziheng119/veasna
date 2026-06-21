interface Props {
  dataString: string
}

export default function NoDataAvailable({ dataString }: Props) {
  return (
    <div className="flex justify-center items-center h-40 text-gray-500 border-2 border-dashed rounded-lg bg-gray-50">
      No {dataString} data available for this patient's visit
    </div>
  )
}