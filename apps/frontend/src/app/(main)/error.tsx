"use client";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border bg-card p-6 text-sm">
      <h2 className="font-semibold">This page could not load</h2>
      <p className="mt-2 text-muted-foreground">
        Check your connection to the host laptop, then retry. If the host was updated,
        you may need to reload this tab after saving any work on other pages.
      </p>
      {/* Retry is explicit: never automatically reload a clinical form or replay a save. */}
      <button type="button" onClick={reset} className="mt-4 rounded-md border px-4 py-2">
        Retry page
      </button>
    </div>
  );
}
