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

A token lasts 7 days; `GET auth/me` returns a renewed one (`"token"`) when less than
3 days are left. The server checks on every request that the account is still active
and has permission for the request: an expired or invalid token, or a disabled
account, returns `401` (sign in again); a request the account isn't allowed to make
returns `403`. Accounts are the `admin` account and screening-day accounts made on the
Accounts page (the old shared `user` account is disabled); see
[accounts and permissions](../../docs/user-roles.md).

**POST** `auth/login`
Body `{ "username": "dec13village", "password": "..." }`. Returns
`{ "token": "...", "user": { "id": 5, "username": "dec13village", "role": "user", "screening_date": "2026-12-13" } }`
plus the host's clock (below). `screening_date` is `null` for the admin.
Wrong details return `401`; a disabled account returns `403`. Limited to 30 attempts
per device every 15 minutes.

**GET** `auth/me`
The signed-in account: `{ "id", "username", "role", "screening_date" }`, plus the host's
clock (below). An expired or revoked token returns `401`: devices rely on this rather
than their own clock to tell that a sign-in has expired.

**Host clock.** `auth/me`, `auth/login` and `/health` also return
`{ "server_time": "<ISO time>", "server_date": "YYYY-MM-DD", "utc_offset_minutes": 420 }`.
Devices use it for anything dated "today" (referral dates, printing, ages, analytics),
because a device that has been offline often has the wrong clock.

**POST** `auth/register`, **POST** `users`
Always `403`: account creation is disabled.

Accounts are listed, created, changed and disabled with `accounts` (admin; see "Accounts, station data and export" below).

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
  "vitals": { "height": 165, "weight": 60, "bp_systolic": 120, "bp_diastolic": 80, "temperature": 36.8 },
  "hef": { "know_of_hef": "yes", "has_hef": "no" },
  "stations": ["triage", "dental", "consultation"],
  "sticker_colour": "light_blue",
  "tb": { "red_flags": ["cough_2_weeks", "fever", "night_sweats"], "notes": "" },
  "request_id": "9f2c4e0a7b1d4c3e8a6f5b2d1c0e9a8b"
}
```

- For an existing patient, send `patientInfo.id`. Otherwise `english_name` and `sex` (`M`/`F`) are required.
- The queue number is always the next one for the location today, assigned under the location's queue lock so devices registering at once get different numbers. A `visit.queue_no` in the body (sent by older apps) is ignored. Group a family afterwards with `POST family`. The visit date is always the host's today.
- `stations` defaults to `triage`, `dental`, `consultation`; `tb` is optional and flags the visit for suspected TB (see TB flag).
- `sticker_colour` is optional: the id of a sticker colour from `form-options` (`sticker_colours`), or blank/`null` for no sticker. Returned on the visit and in `GET queue` rows.
- `request_id` is optional: a one-off id the device makes for this registration (8–64 letters, digits, `-` or `_`). If the same `request_id` is sent again, for example after the Wi-Fi dropped before the answer arrived, nothing new is saved and the first registration is returned with `200` and `"repeated": true`. The app keeps the id until the host confirms the registration.
- A returning patient (`patientInfo.id`) who already has an unfinished visit today is not queued again: `409` with `{ "error": "This patient is already in today's queue as number 12.", "visit_id", "queue_no" }`. Once that visit is finished or discharged they can be registered again.
- Returns `201` with the new visit, `400` for missing or invalid fields, including an unknown location or patient.

---

### Patients

**GET** `patients`
List patients for a location (`location_id` required). Optional `visit_date=YYYY-MM-DD` returns only patients who had a visit on that date. Each patient includes `last_visit_date` (`YYYY-MM-DD`, or `null`): the most recent day they were seen at a screening, `family` (their family letter, or `null`), and `queue_visit_id` and `current_station` (their open visit in today's queue at this location and the station it waits at; both `null` when they aren't queued, and `current_station` is `null` once every station is done).

**GET** `patients/{id}`
Fetch a patient by ID.

**DELETE** `patients/{id}` (admin)
Delete a patient.

**GET** `patient/{id}`
Fetch a patient plus a lightweight visit list (used by the patient details page).

**PUT** `patient/{id}`
Correct a patient’s demographic details: `english_name`, `date_of_birth` (`YYYY-MM-DD`) and `sex` (`M`/`F`) are required; `khmer_name`, `phone_number`, `address` and `location_id` (registered location) are optional, and an omitted `location_id` keeps the current one. The Unique ID is regenerated from the names and date of birth. Sets `last_updated_by` and `last_updated_at`. Takes an optional `expected_updated_at`, as the station saves do: the patient's `last_updated_at` when editing started; `409` with the current `last_updated_at` if the patient was saved since. The old `PUT patients/{id}` route was removed; it wrote to a column that does not exist.

**GET** `patient/visit/{visitId}`
Every record of one visit: `queue_no`, `visit_date`, `location_id`, `location_name`, `completed_at`, then `vitals`, `hef`, `visual_acuity`, `presenting_complaint`, `history`, `seva`, `physiotherapy` (with `painpoints`), `consultation` (with `condition_categories`), `tb` and `referrals` (with `signature`, `signer_name`, `signed_at`). A section is `null` when it was never recorded. Responses carry a content-hash `ETag`, so `If-None-Match` returns `304` only when nothing in the visit changed.

---

### Editing Saved Visits

Every account can correct a saved visit, one section at a time, at the station or on the Patient Details page. A non-admin account only reaches the visits of its day (a screening-day account: its screening date; otherwise the host's today); anything else returns `403`. Deleting stays admin-only.

| Section | Endpoint |
| --- | --- |
| Visit details (queue number, date, location, `sticker_colour`) | `PUT visits/{visitId}` |
| Vitals, HEF | `PUT visits/{visitId}/vitals` |
| TB screening | `PUT visits/{visitId}/tb` |
| Visual acuity, presenting complaint, medical history | `POST triage/visual-acuity`, `POST triage/presenting-complaint`, `POST triage/history` |
| Seva, physiotherapy, dental, consultation, referral | `POST visits/seva/{visitId}`, `POST visits/physiotherapy/{visitId}`, `POST visits/dental/{visitId}`, `POST visits/consultation/{visitId}`, `POST visits/referral/{visitId}` |

The station `POST` endpoints are the same upserts the station pages use. They create a missing record or overwrite the saved one. The Triage, Seva, physiotherapy, dental, consultation and referral saves take an optional `expected_updated_at`: the `last_updated_at` of the record the form loaded or last saved (`physiotherapy` returns it as `lastUpdatedAt`), or `null` when there was none. If the record has been saved since, the save is refused with `409` and the current `last_updated_at`; an invalid value returns `400`. Saves to the same record are handled one at a time (`utils/recordVersion.js`), so of several sent with the same `expected_updated_at` at once, only the first is kept and the rest get `409`. Without the field the later save is kept. The referral save also returns `consultation_updated_at`: the consultation's new `last_updated_at` (it sets `require_referral`), or `null` when there are no notes. Every edit sets `last_updated_by` to the signed-in account and `last_updated_at` to now.

**PUT** `visits/{visitId}`
Body: any of `queue_no` (letters and digits, e.g. `12`, `12A` or `A12`), `visit_date` (`YYYY-MM-DD`) and `location_id`; omitted fields keep their value. Returns `409` if the queue number is already used at that location on that date, and `400` for an unknown location. A changed number, date or location is checked against that location and date's sequence, leaving this visit out, by the same rule as `POST visits`; an unchanged number is not re-checked. This replaces the old route of the same path, which wrote to a column that does not exist.

**PUT** `visits/{visitId}/vitals`
Body: `vitals` (`height`, `weight`, `bmi`, `below_3rd_percentile`, `bp_systolic`, `bp_diastolic`, `temperature`, `notes`, validated like registration), `hef` (`know_of_hef`, `has_hef` as booleans, `notes`), or both. A missing record is created.

**PUT** `visits/{visitId}/tb`
Body: any of `red_flags`, `flag_notes`, `doctor_notes` and `status` (`suspected`, `tb_likely` or `cleared`). Everything can be corrected at any time; `cleared` removes the red TB marker from the queues. A first status change recorded here sets `reviewed_by` and `reviewed_at`. If the red flags or status change and the visit stays flagged, it needs 3 or more red flags (`400` otherwise); an older flag with fewer can still have its notes corrected. Returns `404` if the visit was never flagged for TB.

A referral's signature is not edited from Patient Details. The page resends the saved strokes unchanged, so the original signer and signing time are kept.

---

### Queue

**GET** `queue?location_id={id}&date=YYYY-MM-DD`
Today’s active queue for a location (visits with `completed_at` unset). `date` is optional: omitted, the backend uses its own current date (host time zone), the same date `POST visits` assigns. The frontend omits it so client devices with a wrong clock or time zone still see the same queue. An invalid `location_id` or a non-existent date (e.g. `2026-02-30`) returns `400`.

**Station queues**
Each visit lists the stations it is indicated for and moves through them in clinic order: `triage`, `dental`, `consultation`, `physiotherapy`, `seva`, `pharmacy`. Users and admins may both finish a station, change the remaining route and discharge a visit; this is patient flow, not an edit of saved records. A visit waits in one station's queue at a time: its first station not yet completed. `POST visits` accepts an optional top-level `stations` array from `triage`, `dental`, `consultation` and `seva` (defaults to `triage`, `dental`, `consultation`; `400` for `physiotherapy` or `pharmacy`) and an optional `tb` object (see TB flag). Physiotherapy is added by the doctor (`PUT queue/{visitId}/stations/physiotherapy`), and `pharmacy` is added as the last stop when a prescription is created (`POST prescriptions`), TB visits included. A visit that is already finished keeps its new prescription pending without a Pharmacy stop. The `seva` station is shown as the partner NGO in the app.

**GET** `queue?location_id={id}&date=YYYY-MM-DD&station={station}`
Visits currently waiting at one station, ordered by when they arrived there. Without `station`, the endpoint returns every active visit as before. Each row includes `current_station`, `stations` (`[{ "station": "triage", "completed": true }, ...]`), `tb_status` (`null` unless the visit was ever flagged for TB), `tb_flagged` (`true` while it is flagged: shown in red in every queue), `family` (the patient's family letter, or `null`), `family_waiting` (`true` when done at the current station and waiting for the rest of the family there) and `station_done` (`true` when everything needed at the current station is saved: every Triage section, the station's notes at Consult, Physiotherapy, Dental and the partner NGO, or nothing left to dispense at Pharmacy).

**POST** `queue/{visitId}/stations/{station}/complete`
Finish a station and move the visit to its next indicated station: `{ "visit_id": 3, "completed_station": "triage", "next_station": "consultation", "held": false, "waiting_for": [], "family_moved": [] }`. Finishing the last station completes the visit (`next_station` is `null`). For a patient in a family, members waiting at the same station that day move together: while others there are not done yet, the visit stays (`held: true`, `next_station: null`, `waiting_for: [{ "visit_id", "queue_no", "english_name" }]`); the last one done moves them all, each to their own next station, listed in `family_moved: [{ "visit_id", "queue_no", "completed_station", "next_station" }]`. Returns `409` if the visit is not currently waiting at that station.

**PUT** `queue/{visitId}/stations`
Body `{ "stations": ["seva", "consultation"] }`: the stations the visit still has to go through. Completed stations are kept; pending ones are added or removed to match. Returns `409` for a visit that was ever flagged for TB (flagged or cleared): such a visit only goes to Consultation.

**PUT** `queue/{visitId}/stations/{station}`
Body `{ "needed": true }` adds one station to the remaining route in clinic order, never ahead of the station the patient is waiting at; `{ "needed": false }` takes it off. Used for the partner NGO at Triage and Physiotherapy at Consult. Returns `{ "visit_id", "stations" }` with the remaining route. `400` for `pharmacy` (added by prescribing); `409` for a TB visit, a finished visit, a station already finished, or removing the station the patient is waiting at. Recorded in `visit_station_route_history`.

**POST** `family`
Body `{ "patient_id": 2, "with_patient_id": 1 }` puts patient 2 in patient 1's family, or, when patient 1 has none, starts a family of the two with the first free letter at the location (A, B, ... Z, AA, ...; a letter freed up is used again). Patients need not be in today's queue. A patient moving from another family leaves it; a family left with one member is dissolved (that patient's `family` becomes `null`). Queue numbers don't change. Returns `{ "family": "A", "patients": [{ "patient_id": 2, "family": "A" }, { "patient_id": 1, "family": "A" }] }`. `400` for the same patient or patients of different locations; `404` for an unknown patient. Users and admins may both group families.

**POST** `family/leave`
Body `{ "patient_id": 2 }` takes the patient out of their family: `{ "patient_id": 2, "family": null }`. A family left with one member is dissolved. Family members who were waiting at a station only for this patient move on, and so does this patient if they were waiting for their family.

**GET**, **POST** `visits/dental/{visitId}`
Dental notes: `{ "notes": "...", "referral_needed": true }`. `GET` returns `null` before the first save. `POST` creates the record; only admins can change a saved one (`403`). The Consult page shows both fields so the doctor can refer the patient.

**GET** `queue/next?location_id={id}`
Preview of the next queue number for the location today: `{ "queue_no": "7" }`. Numbers are sequential per location per day, starting at 1. This is a preview only; `POST visits` assigns the actual number.

**POST** `queue/{visitId}/complete`
Discharge: remove a visit from every queue regardless of remaining stations. Sets `completed_at` and `last_updated_by` / `last_updated_at`. The visit record is kept. Idempotent if already completed. Family members who were waiting only for this visit move on. Sending a family member elsewhere with `PUT queue/{visitId}/stations` does the same.

**TB flag**
Suspected TB is a flag on the visit, not a station. A flagged visit goes only to `consultation` (`TB_ROUTE`): at registration it is queued there whatever `stations` says, and flagging or clearing later removes its other unfinished stations and adds `consultation` if missing (unless Consultation is already finished or the visit is discharged). Each such move is recorded in `visit_station_route_history`. Every queue returns the visit with `tb_flagged: true`, so the app marks it in red. Its route can't be edited afterwards, even once cleared (see `PUT queue/{visitId}/stations`); finishing Consultation completes its stations, and its prescriptions stay pending for Pharmacy. (The former TB Tent station was removed by `migrations/016_tb_flag.sql`; open visits waiting there moved to their next station, keeping their flag.)

Flag at registration with `POST visits` body field `tb: { "red_flags": ["cough_2_weeks", "fever", "night_sweats"], "notes": "..." }` (red flags are short keys, see `apps/frontend/src/constants/tb.ts`), or at triage with `POST tb/{visitId}/flag`. A visit is flagged only with **3 or more** red flags (`TB_MIN_RED_FLAGS`); with fewer, both return `400` and nothing is saved. Leave `tb` out to register a patient who isn't flagged.

**GET** `tb/{visitId}`
The visit's TB record (`red_flags`, `flag_notes`, `status`, `flagged`, `doctor_notes`, `flagged_by`, `flagged_at`, `reviewed_by`, `reviewed_at`), or `null` if the visit was never flagged. `status` is `suspected` or `tb_likely` (flagged) or `cleared` (flag removed).

**POST** `tb/{visitId}/flag`
Body `{ "flagged": true, "red_flags": ["cough_2_weeks", "fever", "night_sweats"], "notes": "..." }` flags the visit (3 or more red flags, else `400`); `{ "flagged": false }` clears the flag (the record is kept as `cleared`, with `reviewed_by` set to whoever cleared it). Both send the visit to Consultation as described above; the response includes `current_station` afterwards (`null` for a discharged or finished visit). Anyone may flag a visit that is not flagged yet, or clear a flag. Clearing needs the visit to be waiting at Consultation: a discharged visit, or one waiting at another station, returns `409` (admins correct those with `PUT visits/{visitId}/tb`). Changing an existing flag's red flags or notes needs an admin (`403`) and does not move the patient, so the response has no `current_station`. Clearing a visit that is not flagged changes nothing and returns `{ "visit_id", "status", "flagged": false }`. `404` for an unknown visit.

---

### Pharmacy

**GET** `pharmacy?location_id={id}` lists medicines with `stock_count` (on the shelf), `reserved_count` (held by pending prescriptions) and `available_count` (`stock_count - reserved_count`, what can still be prescribed or dispensed). **GET** `pharmacy/stats?location_id={id}` gives stock totals, including `total_reserved`; out-of-stock and low-stock counts use available stock.

**POST** `pharmacy`
Body `{ "drug_name": "Paracetamol", "stock_count": 100, "location_id": 1 }`. Adds a medicine (both roles). `409` if it already exists at that location.

**PATCH** `pharmacy/{drugId}` (admin)
Body `{ "stock_count": 80 }`. Sets the stock to an exact number (for stock-taking). `409` if it is below what pending prescriptions have reserved.

**PATCH** `pharmacy/{drugId}/name` (admin) renames a medicine. **DELETE** `pharmacy/{drugId}` (admin) removes it; `409` while it has pending prescriptions.

**POST** `pharmacy/{drugId}/dispense` (admin)
Body: `{ "quantity": 3, "request_id": "..." }`. Dispensing without a prescription (e.g. a walk-in). Only available stock can be used: reserved stock is kept for its prescriptions. The medicine row is locked, so dispensing on several devices at once is never lost. Each dispense is recorded in `pharmacy_dispenses` (medicine, quantity, who, when). `request_id` is optional, as for `POST visits`: sent again, it returns the medicine with `"repeated": true` without taking the stock a second time. Returns the updated medicine, `409` with `stock_count` and `available_count` when there is not enough, or `404` for an unknown medicine.

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
Totals only, with no patient names or notes. Admin only. See [analytics](../../docs/analytics.md).

---

### Accounts, station data and export

Screening-day accounts only see patients queued on their date (and those patients'
earlier visits), and save only on that date. Once the host's date is past it, login
returns `403` (after the password is checked) and every other request returns `401`
with a message that the screening has ended. See [accounts](../../docs/user-roles.md).

- **GET** `accounts`, **POST** `accounts` `{ username, password, screening_date }`,
  **PUT** `accounts/{id}` `{ password?, screening_date?, is_active? }`,
  **DELETE** `accounts/{id}`: admin only; only screening-day accounts can be changed.
- **GET** `patients/lookup?location_id={id}&q={name}`: returning patients by name
  (3+ letters), identifying fields only.
- **GET** `form-options`; **PUT** / **DELETE** `form-options/{snellen|tb_red_flags|referral_destinations|consultation_conditions|sticker_colours}`
  (admin). See [station data](../../docs/station-data.md).
- **GET** `export/patients`: every patient and visit, one row per visit. Admin only.
- **DELETE** `visits/{id}`: removes a visit and all its records. Admin only.

---

### Triage and Seva

**POST** `triage/visual-acuity`
Save the Snellen's test for a visit. Body: `visit_id`, `left_without_pinhole`, `right_without_pinhole`, `left_with_pinhole`, `right_with_pinhole`, `left_with_glasses`, `right_with_glasses` (with the patient's own glasses; optional), optional `notes`. Each acuity value is either blank (stored as `null`, reading not taken yet) or a Snellen fraction such as `"20/20"` or `"20/40"`; anything else is rejected with `400`. `POST visits/seva/{visit_id}` applies the same rule to its `*_new` acuity fields, including `left_with_glasses_new` and `right_with_glasses_new`.

`POST visits/seva/{visit_id}` also takes `referral`: `"cataract_surgery"`, `"seva_general"`, or blank/`null` for no referral.

**GET** `visits/referrals?location_id={id|all}&date=YYYY-MM-DD` (or `&from=YYYY-MM-DD&to=YYYY-MM-DD`, or `&all=true`)
Saved referrals for printing, signed or not, oldest first: one day, a period (both days included) or every date, at one location or `all`. A referral counts on its `referral_date`, or its visit's date when it has none. Each row has the referral fields, `signature`, `signer_name`, `signed_at`, and the patient's `patient_id`, `location_id`, names, `sex`, `address` and `date_of_birth`. `400` unless exactly one of `date`, `from`+`to` or `all=true` is given, or when `from` is after `to`. Never cached.

**POST** `visits/referral/{visitId}` `signature` is either drawn strokes (`[[[x, y], ...], ...]`, each 0..1) or an uploaded picture `{ "image": "data:image/png;base64,..." }` (PNG or JPEG, at most 90,000 characters, its contents must match its type); `400` otherwise.

**GET** `visits/seva-referrals?location_id={id}`
Patients at the location that Seva marked for referral (any date, newest visit first), with `referral`, `diagnosis`, `visit_date` and patient details.

The triage, Seva, consultation and referral save endpoints accept partially filled forms: only the visit id is required. Blank dates are stored as `null` and missing text as an empty string.

---

### Deleting a patient

**DELETE** `registration/{patientId}` (admin)
Deletes a patient and everything recorded for them (behind **Delete** on the Patient List). A family left with one member is dissolved, and family members waiting for this patient at a station move on. Returns `404` for an unknown patient.

The older endpoints from an earlier version (`POST registration`, `PUT registration/{id}`, `POST patients`, `GET patients/today`, `DELETE patients/{id}`, `patients/{id}/visual_acuity` and the like, `consultations/{id}/referrals`, `GET users`, `PATCH users/deactivate`) have been removed. Use `POST visits`, `PUT patient/{id}`, `triage/*`, `visits/*` and `accounts` instead.

---

## Error Responses

Errors return JSON with a `message` or `error` field explaining the problem.

| Status | When |
| --- | --- |
| `400` | Missing or invalid input: malformed JSON, non-numeric IDs in the URL (e.g. `/patients/abc`), invalid numbers or dates, or a reference to a deleted record. Field checks may add an `errors` list. |
| `401` | No token (`"Authentication required"`), an expired or invalid token, a disabled account, or wrong sign-in details. The app signs the device out. |
| `403` | The account isn't allowed to do this (`"Your role does not have permission for this action"`), or the visit is outside its day. Also a disabled account at `POST auth/login`. |
| `404` | Unknown address or record, including saving a station form for a visit deleted on another device. |
| `409` | Conflict with the current state: not enough available stock, a prescription that is no longer pending, duplicate queue number, or a station route changed by someone else. |
| `413` | Request body too large. |
| `429` | Rate limit reached (see below). |
| `500` | Unexpected server error (`"Internal server error"`); details go to the server log. |
| `503` | Database unreachable, or permissions couldn't be checked. Try again. |

---

## Rate Limiting

`API_RATE_LIMIT_MAX` (default 5000) `/api` requests per 15 minutes per device (IP address), plus 30 sign-in attempts per 15 minutes per device. Responses include `RateLimit-*` headers; over the limit returns `429`.
