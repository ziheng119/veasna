import LoadingSpinner from "./LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex justify-center items-center h-40 text-gray-500">
      <LoadingSpinner/>
    </div>
  )
}