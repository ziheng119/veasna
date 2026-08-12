import { backend_url } from "@/constants/env_variable";

export async function deletePatient(patientId: number, token: string): Promise<void> {
  const res = await fetch(`${backend_url}/api/registration/${patientId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to delete patient');
  }
}
