import { backend_url } from "@/constants/env_variable";
import { User } from "@/lib/types/user";
import { useHostClockStore } from "@/stores/useHostClockStore";
import { apiFetch, readError } from "@/lib/api/request";

export async function loginUser(username: string, password: string): Promise<User> {
    try {
      const sentAt = Date.now();
      const res = await apiFetch(`${backend_url}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        throw new Error(await readError(res, "Unable to sign in"));
      }

      const body = await res.json();
      const { token, user: backendUser } = body;
      useHostClockStore.getState().sync(body, sentAt);
      const createdUser: User = {
        id: backendUser.id,
        username: backendUser.username,
        token,
        role: backendUser.role,
        screening_date: backendUser.screening_date ?? null,
      };
  
      return createdUser;
    } catch (error) {
      console.error("POST /login error:", error);
      throw error;
    }
  }