import type { Metadata } from "next";
import "./globals.css";
import AppToaster from "@/components/shared/AppToaster";
import AppTooltips from "@/components/shared/AppTooltips";

export const metadata: Metadata = {
  title: "Veasna",
  description: "Developed for Healthcare Screenings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <AppToaster />
        <AppTooltips />
      </body>
    </html>
  );
}
