"use client"

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Props {
  children: React.ReactNode;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export default function AuthWrapper({ children }: Props) {
  const user = useUserStore((state) => state.user);
  const removeUser = useUserStore((state) => state.removeUser);
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user || !user.token || isTokenExpired(user.token)) {
      removeUser();
      router.replace("/login");
    }
  }, [hasHydrated, user, removeUser, router]);

  if (!hasHydrated) return <LoadingSpinner />;

  if (!user || !user.token || isTokenExpired(user.token)) return null;

  return <>{children}</>;
};