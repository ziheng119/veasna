export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
      <span aria-hidden="true" className="h-5 w-5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
      Loading page…
    </div>
  );
}
