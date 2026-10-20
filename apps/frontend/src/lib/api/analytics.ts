import { backend_url } from "@/constants/env_variable";

export interface Analytics {
  date: string;
  locationId: number;
  generatedAt: string;
  summary: {
    people: number; visits: number; consultedPeople: number; dischargedVisits: number;
    referralVisits: number; notesSaved: number; unsignedReferrals: number;
  };
  stations: { station: string; assigned: number; completed: number; waiting: number }[];
  ages: { label: string; count: number }[];
  destinations: { label: string; count: number }[];
}

export async function getAnalytics(locationId: number, date: string, token: string, signal: AbortSignal): Promise<Analytics> {
  const params = new URLSearchParams({ location_id: String(locationId), date });
  const response = await fetch(`${backend_url}/api/analytics?${params}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal,
  });
  if (response.status === 401 || response.status === 403) throw new Error("Administrator access required. Please sign in again.");
  if (!response.ok) throw new Error("Unable to load analytics. Please try again.");
  return response.json();
}
