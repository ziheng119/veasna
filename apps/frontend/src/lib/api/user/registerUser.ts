import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";

// Admin-only: creates an account for another staff member.
export async function registerUser(username: string, password: string): Promise<string> {
  const token = useUserStore.getState().user?.token;
  const res = await fetch(`${backend_url}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.message || `Failed to register user: ${res.status} ${res.statusText}`);
  }

  const { user } = await res.json();
  return user.username;
}
