"use client"

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { backend_url } from '@/constants/env_variable';
import { canAccessPage, defaultPage } from '@/lib/permissions';
import { User } from '@/lib/types/user';

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

  return <PageAccess user={user}>{children}</PageAccess>;
};

function PageAccess({ user, children }: Props & { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const setUser = useUserStore(state => state.setUser);
  const removeUser = useUserStore(state => state.removeUser);
  const [verified, setVerified] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  // Keep the shared layout/live connection mounted between already permitted pages.
  const key = user.token;

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(`${backend_url}/api/auth/me`, {
      headers: { Authorization: `Bearer ${user.token}` }, cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (response.status === 401 || response.status === 403) {
        if (!controller.signal.aborted) { removeUser(); router.replace("/login"); }
        return;
      }
      if (!response.ok) throw new Error("Permission check failed");
      const profile: Pick<User, "id" | "username" | "role"> = await response.json();
      if (controller.signal.aborted) return;
      if (profile.role !== user.role || profile.username !== user.username) {
        setUser({ ...profile, token: user.token });
      }
      if (!canAccessPage(profile.role, pathname)) {
        router.replace(defaultPage(profile.role));
        return;
      }
      setVerified(key);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
    // Refresh permissions on navigation; a profile update must not start an extra request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.token, pathname, retry, removeUser, setUser, router]);

  if (error) return <div role="alert" className="p-6 text-sm">
    <p>Unable to verify page access. Check the connection to the host laptop.</p>
    <button type="button" className="mt-3 underline" onClick={() => setRetry(value => value + 1)}>Retry</button>
  </div>;
  if (verified !== key || !canAccessPage(user.role, pathname)) return <LoadingSpinner />;
  return <>{children}</>;
}
