"use client"

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Props {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: Props) {
  const user = useUserStore((state) => state.user);
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const router = useRouter();

  useEffect(() => {
    if (hasHydrated && !user) {
      router.replace("/login");
    }
  }, [hasHydrated, user, router]);

  // Wait for hydration to complete before rendering or redirecting
  if (!hasHydrated) return <LoadingSpinner />;

  // If no user after hydration, render null while redirect runs
  if (!user) return null;

  // User exists, render children
  return <>{children}</>;
};