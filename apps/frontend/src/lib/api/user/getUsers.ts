import { backend_url } from "@/constants/env_variable";
import { User } from "../../types/user";

export async function getUsers(): Promise<User[]> {
  try {
    const res = await fetch(`${backend_url}/api/users`, {
      cache: "no-cache",
    });

    if (!res.ok) {
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const data: User[] = json;
    console.log("GET Users (Success)", data)
    return data;

  } catch (err) {
    console.error('GET Users (Error):', err);
    return [];
  }
}
