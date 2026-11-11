import { backend_url } from "@/constants/env_variable";
import { apiFetch, readError } from "@/lib/api/request";

export async function deletePatient(patientId: number, token: string): Promise<void> {
  const res = await apiFetch(`${backend_url}/api/registration/${patientId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to delete patient'));
  }
}
