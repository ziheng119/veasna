// src/app/(main)/layout.tsx

import TopNav from "@/components/shared/TopNav";
import AuthWrapper from "../wrappers/AuthWrapper";
import Footer from "@/components/shared/Footer";
import { getLocations } from "@/lib/api/location/getLocations";
import { Location } from "@/lib/types/location";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <>
      <AuthWrapper>
        <TopNav/>
          <main className="flex-1 p-6 bg-background min-h-screen w-full flex justify-start">
            {children}
          </main>
        <Footer />
      </AuthWrapper>
    </>
  );
}
