import { backend_url } from "@/constants/env_variable";
import { Location } from "@/lib/types/location";

export async function createLocation(name: string): Promise<Location> {
  try {
    const res = await fetch(`${backend_url}/api/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      throw new Error(`Failed to add location: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    const location: Location = {
      id: json.location.id,
      name: json.location.name,
      is_active: json.location.is_active,
    };
    
    console.log('POST Location (Success):', location);
    return location;

  } catch (err) {
    console.error('POST Location (Error):', err);
    throw err; // Re-throw to let the calling code handle the error
  }
}
