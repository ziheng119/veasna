import { backend_url } from "@/constants/env_variable";
import { PatientInfo } from "@/lib/types/patient";
import { apiFetch } from "@/lib/api/request";

// Returning patients whose name contains `name` (3 letters or more), with only the details that
// identify them. Lets an account that sees only its own day's patients (no "See past patients")
// link a registration to a villager who came on an earlier trip.
export const LOOKUP_MIN_LENGTH = 3;

export async function lookupPatients(name: string, token: string, signal?: AbortSignal): Promise<PatientInfo[]> {
  const params = new URLSearchParams({ q: name });
  const res = await apiFetch(`${backend_url}/api/patients/lookup?${params}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) throw new Error(`Patient lookup failed (${res.status})`);
  return res.json();
}
