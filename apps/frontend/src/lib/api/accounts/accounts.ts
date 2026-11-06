import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";

// Admin-only account management (apps/backend/routes/accounts.js).

export interface Account {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  // YYYY-MM-DD for a screening-day account; null for the fixed admin and user accounts.
  screening_date: string | null;
  created_at: string;
  last_updated_at: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");
  const res = await fetch(`${backend_url}/api/accounts${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || error.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export const getAccounts = () => request<Account[]>("");

export const createDayAccount = (account: { username: string; password: string; screening_date: string }) =>
  request<Account>("", { method: "POST", body: JSON.stringify(account) });

export const updateDayAccount = (id: number, changes: { password?: string; screening_date?: string; is_active?: boolean }) =>
  request<Account>(`/${id}`, { method: "PUT", body: JSON.stringify(changes) });

/** Removes the account, or disables it when it has entered records (deleted: false). */
export const deleteDayAccount = (id: number) =>
  request<{ id: number; deleted: boolean; disabled?: boolean }>(`/${id}`, { method: "DELETE" });
