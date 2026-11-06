import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import type { FormOption, FormOptionKey, FormOptionList } from "@/lib/types/formOptions";

// Station form choices an admin can change (apps/backend/routes/formOptions.js).

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");
  const res = await fetch(`${backend_url}/api/form-options${path}`, {
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

export function getFormOptions(signal?: AbortSignal) {
  return request<Record<FormOptionKey, FormOptionList>>("", { signal });
}

export function saveFormOptions(key: FormOptionKey, items: FormOption[]) {
  return request<FormOptionList>(`/${key}`, { method: "PUT", body: JSON.stringify({ items }) });
}

/** Goes back to the built-in choices. */
export function resetFormOptions(key: FormOptionKey) {
  return request<FormOptionList>(`/${key}`, { method: "DELETE" });
}
