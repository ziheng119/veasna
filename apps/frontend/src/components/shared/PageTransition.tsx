"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Each page fades and rises in when you move between pages (none for reduced motion). No fill mode,
 * so no transform is left behind to change how fixed-position children are placed.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none xl:h-full">
      {children}
    </div>
  );
}
