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
  "visit": { "queue_no": "12" },
  "vitals": { "height": 165, "weight": 60, "bp_systolic": 120, "bp_diastolic": 80, "temperature": 36.8 },
  "hef": { "know_of_hef": "yes", "has_hef": "no" },
  "stations": ["triage", "consultation"],
  "tb": { "red_flags": ["cough_2_weeks"], "notes": "" }
}
```

- For an existing patient, send `patientInfo.id`. Otherwise `english_name` and `sex` (`M`/`F`) are required.
- Omit `visit.queue_no` to get the next number automatically. The visit date is always the host's today.
- `stations` defaults to every station except `tb`; `tb` is optional (see TB Tent).
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
Body: any of `queue_no` (digits with an optional letter, e.g. `12A`), `visit_date` (`YYYY-MM-DD`) and `location_id`; omitted fields keep their value. Returns `409` if the queue number is already used at that location on that date, and `400` for an unknown location. This replaces the old route of the same path, which wrote to a column that does not exist.

**PUT** `visits/{visitId}/vitals`
Body: `vitals` (`height`, `weight`, `bmi`, `below_3rd_percentile`, `bp_systolic`, `bp_diastolic`, `temperature`, `notes`, validated like registration), `hef` (`know_of_hef`, `has_hef` as booleans, `notes`), or both. A missing record is created.

**PUT** `visits/{visitId}/tb`
Body: any of `red_flags`, `flag_notes`, `doctor_notes` and `status` (`cleared` or `tb_likely`). Red flags and notes can always be corrected. The result decides where the patient may go, so it can only be changed here once the visit is completed (`409` while the patient is still in the clinic; use `POST tb/{visitId}/review` at the TB tent instead). A first result recorded here sets `reviewed_by` and `reviewed_at`. Returns `404` if the visit was never flagged for TB.

A referral's signature is not edited from Patient Details. The page resends the saved strokes unchanged, so the original signer and signing time are kept.

---

### Queue

**GET** `queue?location_id={id}&date=YYYY-MM-DD`
Today’s active queue for a location (visits with `completed_at` unset). `date` is optional: omitted, the backend uses its own current date (host time zone), the same date `POST visits` assigns. The frontend omits it so client devices with a wrong clock or time zone still see the same queue. An invalid `location_id` or a non-existent date (e.g. `2026-02-30`) returns `400`.

**Station queues**
Each visit lists the stations it is indicated for (`tb`, `triage`, `seva`, `physiotherapy`, `consultation`) and moves through them in that order. A visit waits in one station's queue at a time: its first station not yet completed. `POST visits` accepts an optional top-level `stations` array (defaults to every station except `tb`) and an optional `tb` object (see TB Tent).

**GET** `queue?location_id={id}&date=YYYY-MM-DD&station={station}`
Visits currently waiting at one station, ordered by when they arrived there. Without `station`, the endpoint returns every active visit as before. Each row includes `current_station`, `stations` (`[{ "station": "triage", "completed": true }, ...]`) and `tb_status` (`null` unless the visit was flagged for TB).

**POST** `queue/{visitId}/stations/{station}/complete`
Finish a station and move the visit to its next indicated station: `{ "next_station": "consultation" }`. Finishing the last station completes the visit (`next_station` is `null`). Returns `409` if the visit is not currently waiting at that station. The `tb` station cannot be completed here (`409`, `code: "TB_HOLD"`); use `tb/{visitId}/review`.

**PUT** `queue/{visitId}/stations`
Body `{ "stations": ["seva", "consultation"] }`: the stations the visit still has to go through. Completed stations are kept; pending ones are added or removed to match. Including `tb` flags the visit for suspected TB. While the visit is on TB hold, leaving `tb` out returns `409` (`code: "TB_HOLD"`).

**GET** `queue/next?location_id={id}`
Preview of the next queue number for the location today: `{ "queue_no": "7" }`. Numbers are sequential per location per day, starting at 1. This is a preview only; `POST visits` assigns the actual number when `visit.queue_no` is omitted.

**POST** `queue/{visitId}/complete`
Discharge: remove a visit from every queue regardless of remaining stations. Sets `completed_at` and `last_updated_by` / `last_updated_at`. The visit record is kept. Idempotent if already completed.

**TB Tent**
A visit flagged for suspected TB is queued at the `tb` station first and is on **TB hold** until a TB doctor clears it: it cannot move to, or be saved at, any other station. Saving triage, Seva, physiotherapy, consultation or referral data for a visit on TB hold returns `409` with `code: "TB_HOLD"`.

Flag at registration with `POST visits` body field `tb: { "red_flags": ["cough_2_weeks", "night_sweats"], "notes": "..." }` (red flags are short keys, see `apps/frontend/src/constants/tb.ts`), or later by adding `tb` through `PUT queue/{visitId}/stations`.

**GET** `tb/{visitId}`
The visit's TB screening (`red_flags`, `flag_notes`, `status`, `doctor_notes`, `flagged_by`, `flagged_at`, `reviewed_by`, `reviewed_at`), or `null` if the visit was never flagged. `status` is `suspected`, `cleared` or `tb_likely`.

**POST** `tb/{visitId}/review`
Body `{ "decision": "cleared" | "tb_likely", "doctor_notes": "..." }`. `cleared` completes the TB tent and moves the visit to its next station (or finishes the visit): `{ "status": "cleared", "next_station": "triage", "visit_completed": false }`. `tb_likely` (TB not ruled out) keeps the visit at the TB tent until it is discharged. Returns `409` if the visit is not waiting at the TB tent.

---

### Pharmacy

**GET** `pharmacy?location_id={id}` lists medicines with `stock_count`. **GET** `pharmacy/stats?location_id={id}` gives stock totals.

**POST** `pharmacy`
Body `{ "drug_name": "Paracetamol", "stock_count": 100, "location_id": 1 }`. Adds a medicine (both roles). `409` if it already exists at that location.

**PATCH** `pharmacy/{drugId}` (admin)
Body `{ "stock_count": 80 }`. Sets the stock to an exact number (for stock-taking).

**PATCH** `pharmacy/{drugId}/name` (admin) renames a medicine. **DELETE** `pharmacy/{drugId}` (admin) removes it.

**POST** `pharmacy/{drugId}/dispense` (admin)
Body: `{ "quantity": 3 }`. Subtracts from stock in one statement, so dispensing on several devices at once is never lost. Returns the updated medicine, `409` with the current `stock_count` when there is not enough stock, or `404` for an unknown medicine.

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
| `409` | Conflict with the current state: TB hold (`code: "TB_HOLD"`), not enough stock, duplicate queue number, or a station route changed by someone else. |
| `413` | Request body too large. |
| `429` | Rate limit reached (see below). |
| `500` | Unexpected server error (`"Internal server error"`); details go to the server log. |
| `503` | Database unreachable, or permissions couldn't be checked. Try again. |

---

## Rate Limiting

`API_RATE_LIMIT_MAX` (default 5000) `/api` requests per 15 minutes per device (IP address), plus 30 sign-in attempts per 15 minutes per device. Responses include `RateLimit-*` headers; over the limit returns `429`.
