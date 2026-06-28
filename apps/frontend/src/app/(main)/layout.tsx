// src/app/(main)/layout.tsx

import TopNav from "@/components/shared/TopNav";
import AuthWrapper from "../wrappers/AuthWrapper";
import Footer from "@/components/shared/Footer";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <>
      <AuthWrapper>
        <TopNav/>
          <main className="flex-1 min-h-screen w-full bg-background px-6 py-5">
            <div className="mx-auto w-full max-w-[1600px] space-y-5">
              {children}
            </div>
          </main>
        <Footer />
      </AuthWrapper>
    </>
  );
}
