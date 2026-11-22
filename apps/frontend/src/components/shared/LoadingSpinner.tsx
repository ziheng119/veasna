// Full-screen spinner while the app checks the sign-in: a muted ring with a brand-blue arc.
export default function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center" role="status" aria-label="Loading">
      <div className="size-12 animate-spin rounded-full border-[6px] border-muted border-t-primary motion-reduce:animate-none" />
    </div>
  );
}
