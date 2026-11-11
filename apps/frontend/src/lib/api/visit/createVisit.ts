import { backend_url } from "@/constants/env_variable";
import { QueuedPatient } from "@/lib/types/patient";
import { PatientFormData } from "@/lib/types/patient";
import { Vitals } from "@/lib/types/vitals";
import { HEF } from "@/lib/types/hef";
import { StationId } from "@/constants/stations";

export async function createVisit(
    data: {
        patientInfo: PatientFormData;
        vitals: Vitals;
        hef: HEF;
        stations: StationId[];
        // Id from the sticker_colours list; "" or null for no sticker.
        sticker_colour?: string | null;
        // Set when TB red flags were ticked: the patient goes straight to Consultation, marked red.
        tb?: { red_flags: string[]; notes: string } | null;
        // One-off id (lib/requestId.ts): sending the same registration again returns the first.
        request_id?: string;
    },
    token: string
): Promise<QueuedPatient> {
    
    const payload = {
        patientInfo: data.patientInfo,
        vitals: data.vitals,
        hef: data.hef,
        stations: data.stations,
        sticker_colour: data.sticker_colour || null,
        ...(data.tb ? { tb: data.tb } : {}),
        ...(data.request_id ? { request_id: data.request_id } : {}),
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