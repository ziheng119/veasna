// src/app/(main)/layout.tsx

import TopNav from "@/components/shared/TopNav";
import AuthWrapper from "../wrappers/AuthWrapper";
import Footer from "@/components/shared/Footer";
import RealtimeConnection from "@/components/shared/RealtimeConnection";
import ClockWarning from "@/components/shared/ClockWarning";
import PageTransition from "@/components/shared/PageTransition";
import GuideTour from "@/components/guide/GuideTour";
import GuidePage from "@/components/guide/GuidePage";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <>
      <AuthWrapper>
        {/* One screen tall: pages lay out their own scrolling panels (see PageLayout). */}
        {/* The app footer is left off station pages from lg, so the surface runs to the bottom. */}
        <div className="flex h-screen flex-col lg:has-[[data-station-surface]]:[&>footer]:hidden">
          <TopNav/>
          <RealtimeConnection />
          <ClockWarning />
          {/* A station page split into queue and patient (StationSurface) fills the page edge to edge
              from lg, so drops the padding and max width. */}
          <main className="flex-1 min-h-0 w-full overflow-y-auto bg-background px-6 py-5 lg:has-[[data-station-surface]]:p-0">
            <div className="mx-auto w-full max-w-[1600px] lg:h-full lg:has-[[data-station-surface]]:max-w-none">
              <PageTransition><GuidePage>{children}</GuidePage></PageTransition>
            </div>
          </main>
          <Footer />
        </div>
        <GuideTour />
      </AuthWrapper>
    </>
  );
}
