import { backend_url } from "@/constants/env_variable";
import { User } from "@/lib/types/user";

export async function registerUser(username: string, password: string): Promise<User> {
  const res = await fetch(`${backend_url}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.message || `Failed to register user: ${res.status} ${res.statusText}`);
  }

  const { token, user: backendUser } = await res.json();
  return {
    id: backendUser.id,
    username: backendUser.username,
    token,
  };
}
