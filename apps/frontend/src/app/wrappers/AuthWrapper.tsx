"use client"

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { backend_url } from '@/constants/env_variable';
import { canAccessPage, defaultPage } from '@/lib/permissions';
import { User } from '@/lib/types/user';
import { HostClock, useHostClockStore } from '@/stores/useHostClockStore';
import { apiFetch } from '@/lib/api/request';

// The permission check on each page change: retried after these delays before an error shows.
const RETRY_DELAYS_MS = [1000, 3000];
const CHECK_TIMEOUT_MS = 8000;

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
  // Keep the shared layout/live connection mounted between already permitted pages, and when the
  // host renews the sign-in (a new token for the same account must not remount a half-filled form).
  const key = String(user.id);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The host has confirmed this account before: a page change while it can't be reached keeps the
    // page, allowed by the role it last confirmed. The host still checks every request it gets.
    const confirmedBefore = verified === key;
    setError(false);
    const check = (attempt: number) => {
      const sentAt = Date.now();
      apiFetch(`${backend_url}/api/auth/me`, {
        headers: { Authorization: `Bearer ${user.token}` }, cache: "no-store", signal: controller.signal, timeoutMs: CHECK_TIMEOUT_MS,
      }).then(async response => {
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) { removeUser(); router.replace("/login"); }
          return;
        }
        if (!response.ok) throw new Error("Permission check failed");
        const profile: Pick<User, "id" | "username" | "role" | "screening_date"> & HostClock & { token?: string } = await response.json();
        if (controller.signal.aborted) return;
        useHostClockStore.getState().sync(profile, sentAt);
        // The host sends a new token when this sign-in is close to expiry (routes/session.js).
        const token = profile.token || user.token;
        if (profile.role !== user.role || profile.username !== user.username || token !== user.token ||
            (profile.screening_date ?? null) !== (user.screening_date ?? null)) {
          setUser({ id: profile.id, username: profile.username, role: profile.role, screening_date: profile.screening_date, token });
        }
        if (!canAccessPage(profile.role, pathname)) {
          router.replace(defaultPage(profile.role));
          return;
        }
        setVerified(key);
      }).catch(() => {
        if (controller.signal.aborted) return;
        // A brief Wi-Fi drop: try again quietly before showing an error.
        if (attempt < RETRY_DELAYS_MS.length) timer = setTimeout(() => check(attempt + 1), RETRY_DELAYS_MS[attempt]);
        else if (!confirmedBefore) setError(true);
      });
    };
    check(0);
    return () => { controller.abort(); clearTimeout(timer); };
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
