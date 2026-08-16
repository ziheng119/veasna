import { backend_url } from "@/constants/env_variable";
import { PatientInfo } from "@/lib/types/patient";
import { clearPatientCache } from "./getPatients";

export async function updatePatient(
  patientId: number, 
  patientData: Partial<PatientInfo>, 
  token: string
) {
  try {
    const payload = {
      english_name: patientData.english_name ?? '',
      khmer_name: patientData.khmer_name ?? null,
      date_of_birth: patientData.date_of_birth ?? null,
      sex: patientData.sex ?? '',
      phone_number: patientData.phone_number ?? null,
      address: patientData.address ?? null,
    };

    const res = await fetch(`${backend_url}/api/patient/${patientId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 404) {
      console.error(`Patient ${patientId} not found`);
      return { success: false, error: 'Patient not found' };
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Failed to update patient: ${res.statusText}`);
    }

    const data = await res.json();

    // Clear cache for this patient to force fresh data on next fetch
    clearPatientCache(patientId);

    console.log(`UPDATE Patient ${patientId} (Success)`);
    return { success: true, data };
  } catch (err: any) {
    console.error('UPDATE Patient (Error):', err);
    return { 
      success: false, 
      error: err.message || 'An error occurred while updating patient' 
    };
  }
}
