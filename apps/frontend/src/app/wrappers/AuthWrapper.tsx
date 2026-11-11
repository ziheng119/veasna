"use client"

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { backend_url } from '@/constants/env_variable';
import { canAccessPage, defaultPage } from '@/lib/permissions';
import { User } from '@/lib/types/user';
import { HostClock, useHostClockStore } from '@/stores/useHostClockStore';

interface Props {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: Props) {
  const user = useUserStore((state) => state.user);
  const removeUser = useUserStore((state) => state.removeUser);
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    // Expiry is checked by the host (its /auth/me answers 401), not by this device's clock, which
    // may be days out on a tablet that has been offline.
    if (!user || !user.token) {
      removeUser();
      router.replace("/login");
    }
  }, [hasHydrated, user, removeUser, router]);

  if (!hasHydrated) return <LoadingSpinner />;

  if (!user || !user.token) return null;

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
    const sentAt = Date.now();
    fetch(`${backend_url}/api/auth/me`, {
      headers: { Authorization: `Bearer ${user.token}` }, cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (response.status === 401 || response.status === 403) {
        if (!controller.signal.aborted) { removeUser(); router.replace("/login"); }
        return;
      }
      if (!response.ok) throw new Error("Permission check failed");
      const profile: Pick<User, "id" | "username" | "role" | "screening_date"> & HostClock = await response.json();
      if (controller.signal.aborted) return;
      useHostClockStore.getState().sync(profile, sentAt);
      if (profile.role !== user.role || profile.username !== user.username ||
          (profile.screening_date ?? null) !== (user.screening_date ?? null)) {
        setUser({ id: profile.id, username: profile.username, role: profile.role, screening_date: profile.screening_date, token: user.token });
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
