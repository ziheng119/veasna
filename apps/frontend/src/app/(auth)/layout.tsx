export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] items-center justify-center px-4 py-8">
        {children}
      </div>
    </main>
  );
}
