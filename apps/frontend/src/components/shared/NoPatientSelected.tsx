export default function NoPatientSelected() {
  return (
    <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center w-full border-2 border-dashed border-border rounded-xl bg-card text-muted-foreground">
      <h2 className="text-lg font-semibold mb-2 text-foreground">No Patient Selected</h2>
      <p className="text-center text-sm">
        Please select a patient from the list to view their details.
      </p>
    </div>
  );
}
