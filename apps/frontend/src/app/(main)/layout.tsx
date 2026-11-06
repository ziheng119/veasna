// src/app/(main)/layout.tsx

import TopNav from "@/components/shared/TopNav";
import AuthWrapper from "../wrappers/AuthWrapper";
import Footer from "@/components/shared/Footer";
import RealtimeConnection from "@/components/shared/RealtimeConnection";
import PageTransition from "@/components/shared/PageTransition";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <>
      <AuthWrapper>
        {/* One screen tall: pages lay out their own scrolling panels (see PageLayout). */}
        <div className="flex h-screen flex-col">
          <TopNav/>
          <RealtimeConnection />
          <main className="flex-1 min-h-0 w-full overflow-y-auto bg-background px-6 py-5">
            <div className="mx-auto w-full max-w-[1600px] xl:h-full">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
          <Footer />
        </div>
      </AuthWrapper>
    </>
  );
}
