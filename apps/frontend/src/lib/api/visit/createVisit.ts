import { backend_url } from "@/constants/env_variable";
import { QueuedPatient } from "@/lib/types/patient";
import { PatientFormData } from "@/lib/types/patient";
import { Vitals } from "@/lib/types/vitals";
import { HEF } from "@/lib/types/hef";

export async function createVisit(
    data: { patientInfo: PatientFormData; vitals: Vitals; hef: HEF },
    token: string
): Promise<QueuedPatient> {
    
    const payload = {
        patientInfo: data.patientInfo,
        visit: { queue_no: data.patientInfo.queue_no },
        vitals: data.vitals,
        hef: data.hef,
    };

    try {
        const res = await fetch(`${backend_url}/api/visits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `Failed to create visit: ${res.statusText}`);
        }
        return await res.json();

    } catch (err) {
        console.error('POST visit (Error):', err);
        throw err;
    }
}