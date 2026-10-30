# API Documentation

This is the reference for developers working with the Veasna server. Clinic staff
don't need it.

## Base URL

`http://<host-IP>:3000/api` (`http://localhost:3000/api` on the host itself)

## Authentication

Every endpoint except `POST auth/login` needs a signed-in token in the
`Authorization` header:

```
Authorization: Bearer <token>
```

A token lasts 7 days. The server checks on every request that the account is still
active and has permission for the request. There are two fixed accounts, `admin` and
`user`; see [accounts and permissions](../../docs/user-roles.md).

**POST** `auth/login`
Body `{ "username": "user", "password": "user" }`. Returns
`{ "token": "...", "user": { "id": 2, "username": "user", "role": "user" } }`.
Wrong details return `401`; a disabled account returns `403`. Limited to 30 attempts
per device every 15 minutes.

**GET** `auth/me`
The signed-in account: `{ "id", "username", "role" }`.

**POST** `auth/register`, **POST** `users`
Always `403`: account creation is disabled.

**GET** `users` lists accounts. **PATCH** `users/deactivate` (admin) disables one.

---

### Locations

**GET** `locations`
`{ "locations": [{ "id": 1, "name": "Poipet" }, ...] }`

**POST** `locations` (admin), body `{ "name": "..." }`, adds a location.
**DELETE** `locations/{id}` (admin) removes one.

---

### Registration

**POST** `visits`
Registers a visit, creating the patient if needed, in one transaction. This is what the Home form uses.

```json
{
  "patientInfo": { "location_id": 1, "english_name": "Sok Dara", "khmer_name": "សុខ ដារា", "sex": "M", "date_of_birth": "1990-03-07" },
  "visit": { "queue_no": "A12" },
  "vitals": { "height": 165, "weight": 60, "bp_systolic": 120, "bp_diastolic": 80, "temperature": 36.8 },
  "hef": { "know_of_hef": "yes", "has_hef": "no" },
  "stations": ["triage", "consultation"],
  "tb": { "red_flags": ["cough_2_weeks"], "notes": "" }
}
```

- For an existing patient, send `patientInfo.id`. Otherwise `english_name` and `sex` (`M`/`F`) are required.
- Omit `visit.queue_no` to get the next number automatically. A typed queue number is 1-10 letters and digits with at least one digit (`12`, `12A`, `A12`), stored upper-case; `400` if malformed, `409` if already used at the location today. Numbers starting with a letter are a separate series and do not affect the automatic numbers. The visit date is always the host's today.
- `stations` defaults to every station; `tb` is optional and flags the visit for suspected TB (see TB flag).
- Returns `400` for missing or invalid fields, including an unknown location or patient.

---

### Patients

**GET** `patients`
List patients for a location (`location_id` required). Optional `visit_date=YYYY-MM-DD` returns only patients who had a visit on that date. Each patient includes `last_visit_date` (`YYYY-MM-DD`, or `null`): the most recent day they were seen at a screening.

**GET** `patients/{id}`
Fetch a patient by ID.

**DELETE** `patients/{id}` (admin)
Delete a patient.

**GET** `patient/{id}`
Fetch a patient plus a lightweight visit list (used by the patient details page).

**PUT** `patient/{id}` (admin only)
Correct a patient’s demographic details: `english_name`, `date_of_birth` (`YYYY-MM-DD`) and `sex` (`M`/`F`) are required; `khmer_name`, `phone_number`, `address` and `location_id` (registered location) are optional, and an omitted `location_id` keeps the current one. The Unique ID is regenerated from the names and date of birth. Sets `last_updated_by` and `last_updated_at`. The old `PUT patients/{id}` route was removed; it wrote to a column that does not exist.

**GET** `patient/visit/{visitId}`
Every record of one visit: `queue_no`, `visit_date`, `location_id`, `location_name`, `completed_at`, then `vitals`, `hef`, `visual_acuity`, `presenting_complaint`, `history`, `seva`, `physiotherapy` (with `painpoints`), `consultation` (with `condition_categories`), `tb` and `referrals` (with `signature`, `signer_name`, `signed_at`). A section is `null` when it was never recorded. Responses carry a content-hash `ETag`, so `If-None-Match` returns `304` only when nothing in the visit changed.

---

### Editing Saved Visits (admin only)

Users can create records but cannot change them once saved; admins can correct every part of a visit. The Patient Details page edits one section at a time:

| Section | Endpoint |
| --- | --- |
| Visit details | `PUT visits/{visitId}` |
| Vitals, HEF | `PUT visits/{visitId}/vitals` |
| TB screening | `PUT visits/{visitId}/tb` |
| Visual acuity, presenting complaint, medical history | `POST triage/visual-acuity`, `POST triage/presenting-complaint`, `POST triage/history` |
| Seva, physiotherapy, consultation, referral | `POST visits/seva/{visitId}`, `POST visits/physiotherapy/{visitId}`, `POST visits/consultation/{visitId}`, `POST visits/referral/{visitId}` |

The station `POST` endpoints are the same upserts the station pages use. They create a missing record, and they overwrite a saved one only for admins (`403` for users). Every edit sets `last_updated_by` to the admin and `last_updated_at` to now.

**PUT** `visits/{visitId}`
Body: any of `queue_no` (letters and digits, e.g. `12`, `12A` or `A12`), `visit_date` (`YYYY-MM-DD`) and `location_id`; omitted fields keep their value. Returns `409` if the queue number is already used at that location on that date, and `400` for an unknown location. This replaces the old route of the same path, which wrote to a column that does not exist.

**PUT** `visits/{visitId}/vitals`
Body: `vitals` (`height`, `weight`, `bmi`, `below_3rd_percentile`, `bp_systolic`, `bp_diastolic`, `temperature`, `notes`, validated like registration), `hef` (`know_of_hef`, `has_hef` as booleans, `notes`), or both. A missing record is created.

**PUT** `visits/{visitId}/tb`
Body: any of `red_flags`, `flag_notes`, `doctor_notes` and `status` (`suspected`, `tb_likely` or `cleared`). Everything can be corrected at any time; `cleared` removes the red TB marker from the queues. A first status change recorded here sets `reviewed_by` and `reviewed_at`. Returns `404` if the visit was never flagged for TB.

A referral's signature is not edited from Patient Details. The page resends the saved strokes unchanged, so the original signer and signing time are kept.

---

### Queue

**GET** `queue?location_id={id}&date=YYYY-MM-DD`
Today’s active queue for a location (visits with `completed_at` unset). `date` is optional: omitted, the backend uses its own current date (host time zone), the same date `POST visits` assigns. The frontend omits it so client devices with a wrong clock or time zone still see the same queue. An invalid `location_id` or a non-existent date (e.g. `2026-02-30`) returns `400`.

**Station queues**
Each visit lists the stations it is indicated for (`triage`, `seva`, `physiotherapy`, `consultation`) and moves through them in that order. A visit waits in one station's queue at a time: its first station not yet completed. `POST visits` accepts an optional top-level `stations` array (defaults to every station) and an optional `tb` object (see TB flag). The `seva` station is shown as the partner NGO in the app.

**GET** `queue?location_id={id}&date=YYYY-MM-DD&station={station}`
Visits currently waiting at one station, ordered by when they arrived there. Without `station`, the endpoint returns every active visit as before. Each row includes `current_station`, `stations` (`[{ "station": "triage", "completed": true }, ...]`), `tb_status` (`null` unless the visit was ever flagged for TB) and `tb_flagged` (`true` while it is flagged: shown in red in every queue).

**POST** `queue/{visitId}/stations/{station}/complete`
Finish a station and move the visit to its next indicated station: `{ "next_station": "consultation" }`. Finishing the last station completes the visit (`next_station` is `null`). Returns `409` if the visit is not currently waiting at that station.

**PUT** `queue/{visitId}/stations`
Body `{ "stations": ["seva", "consultation"] }`: the stations the visit still has to go through. Completed stations are kept; pending ones are added or removed to match.

**GET** `queue/next?location_id={id}`
Preview of the next queue number for the location today: `{ "queue_no": "7" }`. Numbers are sequential per location per day, starting at 1. This is a preview only; `POST visits` assigns the actual number when `visit.queue_no` is omitted.

**POST** `queue/{visitId}/complete`
Discharge: remove a visit from every queue regardless of remaining stations. Sets `completed_at` and `last_updated_by` / `last_updated_at`. The visit record is kept. Idempotent if already completed.

**TB flag**
Suspected TB is a flag on the visit, not a station. A flagged visit goes through its normal stations and every queue returns it with `tb_flagged: true`, so the app marks it in red for doctors to attend to. (The former TB Tent station was removed by `migrations/016_tb_flag.sql`; open visits waiting there moved to their next station, keeping their flag.)

Flag at registration with `POST visits` body field `tb: { "red_flags": ["cough_2_weeks", "night_sweats"], "notes": "..." }` (red flags are short keys, see `apps/frontend/src/constants/tb.ts`), or at triage with `POST tb/{visitId}/flag`.

**GET** `tb/{visitId}`
The visit's TB record (`red_flags`, `flag_notes`, `status`, `flagged`, `doctor_notes`, `flagged_by`, `flagged_at`, `reviewed_by`, `reviewed_at`), or `null` if the visit was never flagged. `status` is `suspected` or `tb_likely` (flagged) or `cleared` (flag removed).

**POST** `tb/{visitId}/flag`
Body `{ "flagged": true, "red_flags": ["fever"], "notes": "..." }` flags the visit; `{ "flagged": false }` removes the flag (the record is kept as `cleared`). Users may flag a visit that is not flagged yet; changing an existing flag or removing one needs an admin (`403`). `404` for an unknown visit.

---

### Pharmacy

**GET** `pharmacy?location_id={id}` lists medicines with `stock_count` (on the shelf), `reserved_count` (held by pending prescriptions) and `available_count` (`stock_count - reserved_count`, what can still be prescribed or dispensed). **GET** `pharmacy/stats?location_id={id}` gives stock totals, including `total_reserved`; out-of-stock and low-stock counts use available stock.

**POST** `pharmacy`
Body `{ "drug_name": "Paracetamol", "stock_count": 100, "location_id": 1 }`. Adds a medicine (both roles). `409` if it already exists at that location.

**PATCH** `pharmacy/{drugId}` (admin)
Body `{ "stock_count": 80 }`. Sets the stock to an exact number (for stock-taking). `409` if it is below what pending prescriptions have reserved.

**PATCH** `pharmacy/{drugId}/name` (admin) renames a medicine. **DELETE** `pharmacy/{drugId}` (admin) removes it; `409` while it has pending prescriptions.

**POST** `pharmacy/{drugId}/dispense` (admin)
Body: `{ "quantity": 3 }`. Dispensing without a prescription (e.g. a walk-in). Only available stock can be used: reserved stock is kept for its prescriptions. The medicine row is locked, so dispensing on several devices at once is never lost. Returns the updated medicine, `409` with `stock_count` and `available_count` when there is not enough, or `404` for an unknown medicine.

### Prescriptions

Prescriptions are linked to the location's pharmacy. Prescribing **reserves** the quantity at once, so available stock goes down before anything is handed over. Dispensing takes it off `stock_count`; cancelling releases the reservation. Reserved stock is the sum of pending prescriptions, never a separate counter.

**POST** `prescriptions` (both roles)
Body `{ "visit_id": 61, "drug_id": 3, "quantity": 8, "instructions": "1 capsule three times a day" }`. Returns the prescription (`status: "pending"`) with the drug's new `available_count`. `409` with `available_count` when more than is available is asked for; `400` if the drug belongs to another location's pharmacy; `404` for an unknown visit or drug.

**POST** `prescriptions/{id}/dispense` (admin) marks it dispensed and lowers `stock_count`. **POST** `prescriptions/{id}/cancel` (admin) releases the reserved stock. Both return `409` if the prescription is no longer pending.

**GET** `prescriptions?visit_id={id}` lists a visit's prescriptions. **GET** `prescriptions?location_id={id}&status=pending` lists prescriptions waiting at a location's pharmacy. Each row has the drug, `quantity`, `instructions`, `status`, who prescribed/dispensed/cancelled it and when, and the patient's name, `queue_no` and `visit_date`.

**GET** `prescriptions/patients?location_id={id}` lists patients with prescriptions at the location, with `pending_count`, `dispensed_count`, `cancelled_count` and `last_prescribed_at`. **GET** `prescriptions/patient/{patientId}` returns everything the patient was prescribed, newest first.

The consultation record's free-text `prescription` field is kept for notes saved before this; the app shows it read-only.

---

### Analytics

**GET** `analytics?location_id={id}|all&date=YYYY-MM-DD&period=day|week|month|all` and
**GET** `analytics/trend?location_id={id}|all&date=YYYY-MM-DD&range=7d|30d|12w|12m`.
Totals only, with no patient names or notes. See [analytics](../../docs/analytics.md).

---

### Triage and Seva

**POST** `triage/visual-acuity`
Save the Snellen's test for a visit. Body: `visit_id`, `left_with_pinhole`, `left_without_pinhole`, `right_with_pinhole`, `right_without_pinhole`, optional `notes`. Each acuity value is either blank (stored as `null`, reading not taken yet) or a Snellen fraction such as `"6/6"` or `"6/9"`; anything else is rejected with `400`. `POST visits/seva/{visit_id}` applies the same rule to its `*_new` acuity fields.

`POST visits/seva/{visit_id}` also takes `referral`: `"cataract_surgery"`, `"seva_general"`, or blank/`null` for no referral.

**GET** `visits/seva-referrals?location_id={id}`
Patients at the location that Seva marked for referral (any date, newest visit first), with `referral`, `diagnosis`, `visit_date` and patient details.

The triage, Seva, consultation and referral save endpoints accept partially filled forms: only the visit id is required. Blank dates are stored as `null` and missing text as an empty string.

---

### Older endpoints

The app no longer uses these, but they still work. New code should use the visit-based endpoints above (`POST visits`, `triage/*`, `visits/*`).

| Endpoint | Purpose |
| --- | --- |
| `POST patients` | Create a patient (requires `location_id`, `date_of_birth`, `sex`) |
| `GET patients/today`, `GET patients/search?q=` | Today's patients; search by name |
| `POST`/`GET patients/{id}/visual_acuity`, `/presenting_complaint`, `/history`, `/consultations`, `/physiotherapy` | Per-patient records |
| `POST`/`GET consultations/{id}/referrals` | Referrals for a consultation |
| `POST registration`, `PUT registration/{patientId}`, `DELETE registration/{patientId}` (admin) | Create or update a patient with vitals, HEF and a visit in one request |

---

## Error Responses

Errors return JSON with a `message` or `error` field explaining the problem.

| Status | When |
| --- | --- |
| `400` | Missing or invalid input: malformed JSON, non-numeric IDs in the URL (e.g. `/patients/abc`), invalid numbers or dates, or a reference to a deleted record. Field checks may add an `errors` list. |
| `401` | No token (`"Authentication required"`), or wrong sign-in details. |
| `403` | Expired or invalid token, disabled account, or the role isn't allowed to do this (`"Your role does not have permission for this action"`). |
| `404` | Unknown address or record, including saving a station form for a visit deleted on another device. |
| `409` | Conflict with the current state: not enough available stock, a prescription that is no longer pending, duplicate queue number, or a station route changed by someone else. |
| `413` | Request body too large. |
| `429` | Rate limit reached (see below). |
| `500` | Unexpected server error (`"Internal server error"`); details go to the server log. |
| `503` | Database unreachable, or permissions couldn't be checked. Try again. |

---

## Rate Limiting

`API_RATE_LIMIT_MAX` (default 5000) `/api` requests per 15 minutes per device (IP address), plus 30 sign-in attempts per 15 minutes per device. Responses include `RateLimit-*` headers; over the limit returns `429`.
