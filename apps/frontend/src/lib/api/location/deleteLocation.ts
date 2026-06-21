import { backend_url } from "@/constants/env_variable";

export async function deleteLocation(id: number): Promise<void> {
  try {
    const res = await fetch(`${backend_url}/api/locations/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Location not found');
      }
      throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    console.log('DELETE Location (Success):', json.message);

  } catch (err) {
    console.error('DELETE Location (Error):', err);
    throw err; // Re-throw to let the calling code handle the error
  }
}
