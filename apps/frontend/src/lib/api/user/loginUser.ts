import { backend_url } from "@/constants/env_variable";
import { User } from "@/lib/types/user";

export async function loginUser(username: string, password: string): Promise<User> {
    try {
      const res = await fetch(`${backend_url}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Failed to login user: ${res.status} ${res.statusText}`);
      }

      const { token, user: backendUser } = await res.json();
      const createdUser: User = {
        id: backendUser.id,
        username: backendUser.username,
        token,
      };
  
      return createdUser;
    } catch (error) {
      console.error("POST /login error:", error);
      throw error;
    }
  }