export default function NoPatientSelected() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-500">
      <h2 className="text-lg font-semibold mb-2">No Patient Selected</h2>
      <p className="text-center text-sm">
        Please select a patient from the list to view their details.
      </p>
    </div>
  );
}
