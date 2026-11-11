// The guided tour's sample patient. While the tour runs, apiFetch (lib/api/request.ts) asks
// sampleReply() first: queues and patient lists hold only this patient, and their records come
// from here. Each station step opens them with ?visit=SAMPLE_ID, so staff see a station's real
// forms filled in, as if the patient had come through the earlier stations. Nothing reaches the
// host: the sample is never stored, and saving it is refused.
import { useGuideStore } from "@/stores/useGuideStore";
import type { StationId } from "@/constants/stations";
import { SAMPLE_ID } from "./sampleId";
// Where the sample patient goes, in clinic order.
const ROUTE: StationId[] = ["triage", "dental", "consultation", "physiotherapy", "seva", "pharmacy"];

const NAME = { english_name: "Dara Sok (sample)", khmer_name: "សុខ ដារា" };
const today = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString();

// The sample waiting at `station`, done with the stations before it.
function queued(station: StationId) {
  const at = ROUTE.indexOf(station);
  return {
    visit_id: SAMPLE_ID, patient_id: SAMPLE_ID, queue_no: "S1", sticker_colour: null, family: null,
    ...NAME, sex: "F", age: 42, timestamp: "08:30 AM", station_arrival_time: "09:15 AM",
    current_station: station, family_waiting: false, tb_status: null, tb_flagged: false,
    previous_visits: 0, station_done: false,
    stations: ROUTE.map((entry, index) => ({ station: entry, completed: index < at })),
  };
}

function patient(locationId: number) {
  return {
    id: SAMPLE_ID, face_id: null, location_id: locationId, ...NAME, date_of_birth: "1984-03-12", sex: "F",
    address: "Village 3", phone_number: null, lastUpdated: stamp(), last_visit_date: today(), last_visit_at: stamp(),
    family: null, queue_visit_id: SAMPLE_ID, current_station: "triage",
  };
}

function prescriptions(locationId: number) {
  return [{
    id: SAMPLE_ID, visit_id: SAMPLE_ID, drug_id: null, drug_name: "Paracetamol 500 mg", quantity: 20,
    instructions: "2 tablets up to 4 times a day, after food", status: "pending", prescribed_at: stamp(),
    prescribed_by: "doctor", dispensed_at: null, dispensed_by: null, cancelled_at: null, cancelled_by: null,
    patient_id: SAMPLE_ID, queue_no: "S1", visit_date: today(), location_id: locationId, ...NAME,
  }];
}

// Each of the sample visit's records, by the path after /api/.
function record(path: string): unknown {
  const saved = { last_updated_at: stamp(), created_at: stamp() };
  const records: Record<string, unknown> = {
    [`visits/vitals/${SAMPLE_ID}/${SAMPLE_ID}`]: {
      height: "155", weight: "52", bmi: "21.6", below_3rd_percentile: false, category: "Normal",
      bp_systolic: "128", bp_diastolic: "82", temperature: "36.8", notes: "", ...saved,
    },
    [`visits/visual-acuity/${SAMPLE_ID}/${SAMPLE_ID}`]: {
      right_without_pinhole: "6/12", right_with_pinhole: "6/6", left_without_pinhole: "6/18", left_with_pinhole: "6/9",
      right_with_glasses: "", left_with_glasses: "", notes: "Blurry vision in the left eye.", ...saved,
    },
    [`visits/presenting-complaint/${SAMPLE_ID}/${SAMPLE_ID}`]: {
      history: "Toothache for two weeks, and lower back pain after working in the rice field.",
      red_flags: "None", systems_review: "Otherwise well", drug_allergies: "None known", ...saved,
    },
    [`visits/history/${SAMPLE_ID}/${SAMPLE_ID}`]: {
      past: "High blood pressure", drug_and_treatment: "None", family: "Mother had diabetes",
      social: "Rice farmer, doesn't smoke", systems_review: "Nothing else of note", ...saved,
    },
    [`tb/${SAMPLE_ID}`]: null,
    [`visits/dental/${SAMPLE_ID}`]: {
      notes: "Decay in a lower left molar: cleaned and filled. Shown how to brush twice a day.", referral_needed: false, ...saved,
    },
    [`visits/consultation/${SAMPLE_ID}`]: {
      id: SAMPLE_ID, notes: "Blood pressure slightly high: recheck next visit. Back strain from lifting: sent to Physiotherapy. Paracetamol for the pain.",
      condition_categories: null, prescription: "", require_referral: false,
      referral_date: null, referral_type: null, illness: null, duration: null, reason: null, referral_updated_at: null, ...saved,
    },
    [`visits/physiotherapy/${SAMPLE_ID}`]: {
      notes: "Lower back strain. Showed stretches to do each morning, and heat at home.",
      painpoints: [{ xCoord: 50, yCoord: 44 }], lastUpdatedAt: stamp(),
    },
    [`visits/seva/${SAMPLE_ID}`]: {
      right_without_pinhole_new: "6/12", right_with_pinhole_new: "6/6", left_without_pinhole_new: "6/18", left_with_pinhole_new: "6/9",
      right_with_glasses_new: "", left_with_glasses_new: "", diagnosis: "Early cataract, left eye",
      date_of_referral: null, referral: "", notes: "Check again at the next screening.", ...saved,
    },
    [`patients/${SAMPLE_ID}`]: patient(0),
  };
  return records[path];
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Whether the sample has been shown since the tour started: its pages then need reloading after.
let served = false;
export const sampleWasShown = () => served;
export const forgetSample = () => { served = false; };

// The tour's answer for a request, or null to send it to the host as usual.
export function sampleReply(url: string, method = "GET"): Response | null {
  if (!useGuideStore.getState().active) return null;
  const { pathname, searchParams } = new URL(url, "http://host");
  const path = pathname.replace(/^.*?\/api\//, "");
  const locationId = Number(searchParams.get("location_id")) || 0;
  const aboutSample = path.split("/").includes(String(SAMPLE_ID)) || searchParams.get("visit_id") === String(SAMPLE_ID);
  if (method.toUpperCase() !== "GET") {
    return aboutSample ? json({ error: "This is the guide's sample patient: nothing is saved." }, 403) : null;
  }

  let body: unknown;
  if (path === "queue") body = [queued((searchParams.get("station") as StationId | null) ?? "triage")];
  else if (path === "patients") body = [patient(locationId)];
  else if (path === "prescriptions" && (searchParams.has("location_id") || aboutSample)) body = prescriptions(locationId);
  else if (path === `prescriptions/patient/${SAMPLE_ID}`) body = prescriptions(locationId);
  else if (aboutSample) {
    body = record(path);
    if (body === undefined) return json({ error: "Not part of the sample" }, 404);
  } else return null;
  served = true;
  return json(body);
}
