import { backend_url } from "@/constants/env_variable";
import { apiFetch, readError } from "@/lib/api/request";

// trip: the run of clinic dates (a few days apart at most) ending at the selected date.
export type AnalyticsPeriod = "day" | "week" | "month" | "trip" | "all";
export type TrendRange = "7d" | "30d" | "12w" | "12m";

export interface Analytics {
  period: AnalyticsPeriod;
  startDate: string | null;
  endDate: string;
  date: string;
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
  // One row per clinic date in the period, with the screening-day accounts for it (named for the village).
  days?: { date: string; accounts: string[]; people: number; consultedPeople: number; referralVisits: number }[];
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
  // Set when the buckets follow the page's period (getAnalyticsTrend); null for a fixed range.
  period?: AnalyticsPeriod | null;
  range: TrendRange | null;
  unit?: "day" | "week" | "month";
  date: string;
  generatedAt: string;
  buckets: TrendBucket[];
}

async function request<T>(path: string, params: Record<string, string>, token: string, signal: AbortSignal, failure: string): Promise<T> {
  const response = await apiFetch(`${backend_url}/api/analytics${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal,
  });
  if (response.status === 401) throw new Error("Access unavailable. Please sign in again.");
  // 403: the account lost the Analytics permission; the host says so.
  if (!response.ok) throw new Error(await readError(response, failure));
  return response.json();
}

export function getAnalytics(date: string, token: string, signal: AbortSignal, period: AnalyticsPeriod = "day"): Promise<Analytics> {
  return request("", { date, period }, token, signal, "Unable to load analytics. Please try again.");
}

/** Trend buckets covering the same period as the numbers above them (see periodTrend in the backend). */
export function getAnalyticsTrend(date: string, period: AnalyticsPeriod, token: string, signal: AbortSignal): Promise<AnalyticsTrend> {
  return request("/trend", { date, period }, token, signal, "Unable to load trends. Please try again.");
}

/** A patient on a referral list: one referred visit. Ages are at the visit date (null if unknown). */
export interface ReferredPatient {
  visitId: number;
  patientId: number;
  queueNo: string;
  visitDate: string;
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
  // The same markers as the queue: sticker colour id, family letter, "flagged" for suspected TB.
  stickerColour?: string | null;
  family?: string | null;
  tbStatus?: string | null;
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
  generatedAt: string;
  destinations: ReferralList[];
}

export function getAnalyticsReferrals(date: string, period: AnalyticsPeriod, token: string, signal: AbortSignal): Promise<AnalyticsReferralLists> {
  return request("/referrals", { date, period }, token, signal, "Unable to load referral lists. Please try again.");
}

/** A patient on a follow-up list: one visit in the period. */
export interface FollowUpPatient {
  visitId: number;
  patientId: number;
  queueNo: string;
  visitDate: string;
  englishName: string | null;
  khmerName: string | null;
  stickerColour: string | null;
  family: string | null;
  tbStatus: string | null;
}

/** Who still needs something before the day can be closed. `…More` is true when a list was cut short. */
export interface AnalyticsFollowUp {
  period: AnalyticsPeriod;
  date: string;
  generatedAt: string;
  notDischarged: (FollowUpPatient & { station: string | null })[];
  notDischargedMore: boolean;
  unsignedReferrals: (FollowUpPatient & { destinations: string[] })[];
  unsignedReferralsMore: boolean;
}

export function getAnalyticsFollowUp(date: string, period: AnalyticsPeriod, token: string, signal: AbortSignal): Promise<AnalyticsFollowUp> {
  return request("/follow-up", { date, period }, token, signal, "Unable to load the follow-up lists. Please try again.");
}

/** A patient the Partner NGO station marked for referral: one visit. */
export interface PartnerNgoReferral {
  visitId: number;
  patientId: number;
  queueNo: string;
  visitDate: string;
  // The id on the seva_referrals list; referralDate is the date set on the form (null if none).
  referral: string;
  referralDate: string | null;
  diagnosis: string | null;
  englishName: string | null;
  khmerName: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  stickerColour?: string | null;
  family?: string | null;
  tbStatus?: string | null;
}

/** Patients of one referral type. `listed` is false for a type no longer on the Station data list. */
export interface PartnerNgoReferralType {
  id: string;
  label: string;
  listed: boolean;
  patients: PartnerNgoReferral[];
}

export interface AnalyticsPartnerNgo {
  period: AnalyticsPeriod;
  date: string;
  generatedAt: string;
  types: PartnerNgoReferralType[];
  // True when the list was cut short (over 500 patients).
  more: boolean;
}

export function getAnalyticsPartnerNgo(date: string, period: AnalyticsPeriod, token: string, signal: AbortSignal): Promise<AnalyticsPartnerNgo> {
  return request("/partner-ngo", { date, period }, token, signal, "Unable to load the Partner NGO referrals. Please try again.");
}
