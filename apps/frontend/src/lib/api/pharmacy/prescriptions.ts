import { backend_url } from "@/constants/env_variable";
import { useUserStore } from "@/stores/useUserStore";
import { Prescription, PrescriptionPatient } from "@/lib/types/prescription";
import { clearPharmacyCache } from "./pharmacy";

// Prescribing reserves stock straight away; dispensing takes it off the shelf; cancelling
// releases it. Stock counts change with every call, so the pharmacy cache is cleared.

function authHeaders(json = false): HeadersInit {
  const token = useUserStore.getState().user?.token;
  if (!token) throw new Error("User not authenticated");
  return json
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, init: RequestInit = {}, fallback = "Request failed"): Promise<T> {
  const res = await fetch(`${backend_url}/api/prescriptions${path}`, { cache: "no-cache", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || body?.message || fallback);
  }
  return res.json();
}

export function getVisitPrescriptions(visitId: number, signal?: AbortSignal) {
  return request<Prescription[]>(`?visit_id=${visitId}`, { headers: authHeaders(), signal }, "Failed to load prescriptions");
}

export function getLocationPrescriptions(locationId: number, status?: "pending", signal?: AbortSignal) {
  const filter = status ? `&status=${status}` : "";
  return request<Prescription[]>(`?location_id=${locationId}${filter}`, { headers: authHeaders(), signal }, "Failed to load prescriptions");
}

export function getPrescriptionPatients(locationId: number, signal?: AbortSignal) {
  return request<PrescriptionPatient[]>(`/patients?location_id=${locationId}`, { headers: authHeaders(), signal }, "Failed to load patients");
}

export function getPatientPrescriptions(patientId: number, signal?: AbortSignal) {
  return request<Prescription[]>(`/patient/${patientId}`, { headers: authHeaders(), signal }, "Failed to load prescriptions");
}

// Refused by the server (with the available count in the message) if the stock is not there.
export async function createPrescription(prescription: { visit_id: number; drug_id: number; quantity: number; instructions: string }) {
  try {
    return await request<Prescription & { available_count: number }>("", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(prescription),
    }, "Failed to prescribe");
  } finally {
    clearPharmacyCache();
  }
}

export async function dispensePrescription(id: number) {
  try {
    return await request<Prescription>(`/${id}/dispense`, { method: "POST", headers: authHeaders() }, "Failed to dispense");
  } finally {
    clearPharmacyCache();
  }
}

export async function cancelPrescription(id: number) {
  try {
    return await request<Prescription>(`/${id}/cancel`, { method: "POST", headers: authHeaders() }, "Failed to cancel prescription");
  } finally {
    clearPharmacyCache();
  }
}
