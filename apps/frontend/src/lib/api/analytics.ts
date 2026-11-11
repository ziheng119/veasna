import { backend_url } from "@/constants/env_variable";
import { apiFetch } from "@/lib/api/request";

export type AnalyticsPeriod = "day" | "week" | "month" | "all";
export type AnalyticsLocation = number | "all";
export type TrendRange = "7d" | "30d" | "12w" | "12m";

export interface Analytics {
  period: AnalyticsPeriod;
  startDate: string | null;
  endDate: string;
  date: string;
  locationId: AnalyticsLocation;
  generatedAt: string;
  conditions: { id: string; label: string; count: number }[];
  summary: {
    consultedVisits: number; conditionReviewedVisits: number;
    people: number; visits: number; consultedPeople: number; dischargedVisits: number;
    referralVisits: number; notesSaved: number; unsignedReferrals: number;
  };
  stations: { station: string; assigned: number; completed: number; waiting: number }[];
  ages: { label: string; count: number }[];
  destinations: { label: string; count: number }[];
  locations: { locationId: number; people: number; visits: number }[];
}

export interface TrendBucket {
  startDate: string;
  endDate: string;
  visits: number;
  people: number;
  consultedPeople: number;
  conditions: Record<string, number>;
}

export interface AnalyticsTrend {
  range: TrendRange;
  date: string;
  locationId: AnalyticsLocation;
  generatedAt: string;
  buckets: TrendBucket[];
}

async function request<T>(path: string, params: Record<string, string>, token: string, signal: AbortSignal, failure: string): Promise<T> {
  const response = await apiFetch(`${backend_url}/api/analytics${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal,
  });
  if (response.status === 401 || response.status === 403) throw new Error("Access unavailable. Please sign in again.");
  if (!response.ok) throw new Error(failure);
  return response.json();
}

export function getAnalytics(locationId: AnalyticsLocation, date: string, token: string, signal: AbortSignal, period: AnalyticsPeriod = "day"): Promise<Analytics> {
  return request("", { location_id: String(locationId), date, period }, token, signal, "Unable to load analytics. Please try again.");
}

export function getAnalyticsTrend(locationId: AnalyticsLocation, date: string, range: TrendRange, token: string, signal: AbortSignal): Promise<AnalyticsTrend> {
  return request("/trend", { location_id: String(locationId), date, range }, token, signal, "Unable to load trends. Please try again.");
}

/** A patient on a referral list: one referred visit. Ages are at the visit date (null if unknown). */
export interface ReferredPatient {
  visitId: number;
  patientId: number;
  queueNo: string;
  visitDate: string;
  locationName: string | null;
  englishName: string | null;
  khmerName: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  age: number | null;
  phone: string | null;
  address: string | null;
  referralDate: string | null;
  condition: string | null;
  reason: string | null;
  signed: boolean;
}

/** Patients referred to one destination. `listed` is false for a name no longer on the Station data list. */
export interface ReferralList {
  label: string;
  listed: boolean;
  patients: ReferredPatient[];
}

export interface AnalyticsReferralLists {
  period: AnalyticsPeriod;
  date: string;
  locationId: AnalyticsLocation;
  generatedAt: string;
  destinations: ReferralList[];
}

export function getAnalyticsReferrals(locationId: AnalyticsLocation, date: string, period: AnalyticsPeriod, token: string, signal: AbortSignal): Promise<AnalyticsReferralLists> {
  return request("/referrals", { location_id: String(locationId), date, period }, token, signal, "Unable to load referral lists. Please try again.");
}
