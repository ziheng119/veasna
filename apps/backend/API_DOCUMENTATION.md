# API Documentation

## Base URL

`http://localhost:3000/api`

## Authentication

Authentication is **optional**. Endpoints accept requests without a token. If you choose to log in, include a JWT in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### Authentication

**POST** `users`
Creates a new user with just a username.

* **Body**

  ```json
  { "username": "alice" }
  ```

* **Response (201)**

  ```json
  {
    "message": "User created successfully",
    "user": { "id": 1, "username": "alice" }
  }
  ```

---

**POST** `session/login`
Passwordless login (optional) that upserts the user and returns a JWT.

* **Body**

  ```json
  { "username": "alice" }
  ```

* **Response (200)**

  ```json
  {
    "token": "<jwt-token>",
    "user": {
      "id": 1,
      "username": "alice"
    }
  }
  ```

---

**GET** `profile`
Fetches the current user’s profile.

* **Response (200)**

  ```json
  {
    "id": 1,
    "username": "johndoe",
    "role": "doctor",
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2025-07-09T07:00:00.000Z"
  }
  ```

---

### Patients

**GET** `patients`
List patients for a location (`location_id` required). Optional `visit_date=YYYY-MM-DD` returns only patients who had a visit on that date. Each patient includes `last_visit_date` (`YYYY-MM-DD`, or `null`): the most recent day they were seen at a screening.

**POST** `patients`
Create a new patient.

* **Body**

  ```json
  {
    "english_name": "John Smith",
    "khmer_name": "ចន ស្មីត",
    "date_of_birth": "1990-01-01",
    "sex": "M",
    "phone_number": "+855123456789",
    "address": "Phnom Penh, Cambodia"
  }
  ```

**GET** `patients/{id}`
Fetch a patient by ID.

**DELETE** `patients/{id}`
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

### Vitals

**POST** `patients/{id}/vitals`
Add a vitals record to a patient.

* **Body**

  ```json
  {
    "height_cm": 175.0,
    "weight_kg": 70.0,
    "bmi": 22.9,
    "blood_pressure": "120/80",
    "temperature_c": 36.8,
    "vitals_notes": "Patient appears healthy"
  }
  ```

**GET** `patients/{id}/vitals`
List all vitals records for a patient.

---

### HEF

**POST** `patients/{id}/hef`
Add an HEF record.

**GET** `patients/{id}/hef`
List HEF records.

---

### Visual Acuity

**POST** `patients/{id}/visual_acuity`
Add a visual acuity record.

**GET** `patients/{id}/visual_acuity`
List visual acuity records.

**POST** `triage/visual-acuity`
Save the Snellen's test for a visit. Body: `visit_id`, `left_with_pinhole`, `left_without_pinhole`, `right_with_pinhole`, `right_without_pinhole`, optional `notes`. Each acuity value is either blank (stored as `null`, reading not taken yet) or a Snellen fraction such as `"6/6"` or `"6/9"`; anything else is rejected with `400`. `POST visits/seva/{visit_id}` applies the same rule to its `*_new` acuity fields.

`POST visits/seva/{visit_id}` also takes `referral`: `"cataract_surgery"`, `"seva_general"`, or blank/`null` for no referral.

**GET** `visits/seva-referrals?location_id={id}`
Patients at the location that Seva marked for referral (any date, newest visit first), with `referral`, `diagnosis`, `visit_date` and patient details.

The triage, Seva, consultation and referral save endpoints accept partially filled forms: only the visit id is required. Blank dates are stored as `null` and missing text as an empty string.

---

### Presenting Complaint

**POST** `patients/{id}/presenting_complaint`
Add a presenting complaint.

**GET** `patients/{id}/presenting_complaint`
List presenting complaints.

---

### History

**POST** `patients/{id}/history`
Add a history record.

**GET** `patients/{id}/history`
List history records.

---

### Consultation

**POST** `patients/{id}/consultations`
Create a consultation.

**GET** `patients/{id}/consultations`
List consultations for a patient.

---

### Referral

**POST** `consultations/{id}/referrals`
Add a referral to a consultation.

**GET** `consultations/{id}/referrals`
List referrals for a consultation.

---

### Physiotherapy

**POST** `patients/{id}/physiotherapy`
Add a physiotherapy record.

**GET** `patients/{id}/physiotherapy`
List physiotherapy records.

---

### Combined Registration

**POST** `registration`  
Create a patient and optionally append vitals, HEF, and visit in one request.

**PUT** `registration/{patientId}`  
**Combined update (patient + optional append vitals/HEF/visit)**  
Update patient data and optionally append a vitals record, HEF record, and/or visit in a single call.

**DELETE** `registration/{patientId}`  
Delete a patient (cascades to vitals/HEF/visits).

---

## Error Responses

* **400 Validation Error**

  ```json
  {
    "message": "Validation failed",
    "errors": [ /* field errors */ ]
  }
  ```
* **401 Authentication Error**

  ```json
  {
    "message": "Access token required"
  }
  ```
* **403 Authorization Error**

  ```json
  {
    "message": "Insufficient permissions"
  }
  ```
* **404 Not Found**

  ```json
  {
    "message": "Resource not found"
  }
  ```
* Malformed JSON bodies, non-integer IDs in the URL (e.g. `/patients/abc`) and values PostgreSQL rejects (invalid numbers or dates, references to deleted records) return `400`, never `500`.
* Saving a station form for a visit that no longer exists (e.g. deleted on another device) returns `404`.
* **500 Server Error**

  ```json
  {
    "message": "Internal server error"
  }
  ```

---

## Rate Limiting

100 requests per 15 minutes per IP.
