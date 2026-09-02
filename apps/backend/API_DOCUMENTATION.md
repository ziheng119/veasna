# API Documentation

## Base URL

`http://<host>:3000/api` (clients on a LAN use the host's IP, not `localhost`).

## Authentication

Every `/api` route **except** `/api/auth/*` and `/health` requires a JWT:

```
Authorization: Bearer <token>
```

Get a token from `POST /api/auth/register` or `POST /api/auth/login`. There is
no role system — any authenticated user may call any endpoint (see
`AGENTS.md`: "Do not introduce complex RBAC unless explicitly requested").

Tokens expire after 7 days.

## Rate limiting

Per client IP, 15-minute window:

- `/api/auth/*` — `AUTH_RATE_LIMIT_MAX` (default 100), always enforced.
- `/api/*` — `API_RATE_LIMIT_MAX` (default 1000), skipped when `OFFLINE_MODE=true`.

---

## Auth

### POST `/api/auth/register`

Public by default (`ALLOW_OPEN_REGISTRATION=false` requires a token).

Body: `{ "username": "alice", "password": "min-8-chars" }`
→ `201 { "token": "...", "user": { "id": 1, "username": "alice" } }`
→ `409` username taken · `400` validation

### POST `/api/auth/login`

Body: `{ "username": "alice", "password": "..." }`
→ `200 { "token": "...", "user": { "id": 1, "username": "alice" } }`
→ `401` bad credentials · `403` inactive account

---

## Users

- **GET** `/api/users` → `[{ "username": "alice" }, ...]` (active users)
- **POST** `/api/users` — body `{ "username": "bob" }` → `201 { message, user }` (creates or reactivates a username-only user)
- **PATCH** `/api/users/deactivate` — body `{ "username": "bob" }` → `200 { message, user }`

---

## Locations

- **GET** `/api/locations` → `{ "locations": [{ "id": 1, "name": "Poipet" }, ...] }`
- **POST** `/api/locations` — body `{ "name": "Sisophon" }` → `201 { message, location }`
- **DELETE** `/api/locations/:id` → `200` (soft delete: `is_active = false`)

---

## Patients

- **GET** `/api/patients?location_id={id}[&visit_date=YYYY-MM-DD]` → patient rows (+ `location_name`); `visit_date` filters to patients with a visit that day.
- **GET** `/api/patients/search?q={text}` → up to 10 patients matching English/Khmer name.
- **GET** `/api/patients/:id` → one patient row.
- **GET** `/api/patient/:id` → `{ patient, visits: [{ visit_id, queue_no, visit_date, location_name, has_vitals, has_presenting_complaint, has_seva, has_physiotherapy, has_consultation }] }` (supports `If-None-Match`).
- **PUT** `/api/patient/:id` — body `{ english_name, khmer_name, date_of_birth, sex, phone_number, address }` → `{ patient }`. `english_name`, `date_of_birth`, `sex` required.
- **GET** `/api/patient/visit/:visitId` → full visit detail: `{ visit_id, patient_id, queue_no, visit_date, location_name, vitals, hef, visual_acuity, presenting_complaint, history, seva, physiotherapy, consultation, referrals, dispensed }` (each section `null`/`[]` when absent; supports `If-None-Match`).
- **DELETE** `/api/registration/:patientId` → deletes the patient and cascades to visits/vitals/etc.

---

## Queue

- **GET** `/api/queue?location_id={id}&date=YYYY-MM-DD` → active visits (not yet completed):
  `[{ visit_id, patient_id, queue_no, english_name, khmer_name, sex, age, timestamp }]`
- **POST** `/api/queue/:visitId/complete` → `{ visit }`. Sets `completed_at`; removes the visit from the queue. Idempotent.

Queue numbers are `digits` + optional letter suffix (`3`, `3A`, `12B`). One
active visit per `(location, date, queue_no)` — a collision returns `409`.

---

## Visits

### POST `/api/visits`

Creates (or, with `patientInfo.id`, updates) a patient and opens a visit with
vitals + HEF.

```json
{
  "patientInfo": { "id": 42, "english_name": "...", "khmer_name": "...",
                   "date_of_birth": "1990-01-01", "sex": "M",
                   "phone_number": "...", "address": "...",
                   "face_id": 123, "location_id": 1 },
  "visit":  { "queue_no": "12A" },
  "vitals": { "height": 170, "weight": 65, "bmi": 22.5,
              "below_3rd_percentile": false,
              "bp_systolic": 120, "bp_diastolic": 80,
              "temperature": 36.7, "notes": "" },
  "hef":    { "know_of_hef": "yes", "has_hef": "no", "notes": "" }
}
```

→ `201 { visit_id, patient_id, queue_no, english_name, khmer_name, age, sex, timestamp }`
→ `409` duplicate active queue number / Face ID · `400` invalid vitals or missing fields

### Per-visit reads (all require auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/visits/vitals/:patientId/:visitId` | |
| GET | `/api/visits/history/:patientId/:visitId` | |
| GET | `/api/visits/visual-acuity/:patientId/:visitId` | |
| GET | `/api/visits/presenting-complaint/:patientId/:visitId` | `404` when unset |
| GET / POST | `/api/visits/seva/:visitId` | POST upserts |
| GET / POST | `/api/visits/physiotherapy/:visitId` | POST body `{ notes, painpoints: [{ xCoord, yCoord }] }` |
| GET / POST | `/api/visits/consultation/:visitId` | POST body `{ notes, prescription, require_referral }`; GET supports `If-None-Match` |
| POST | `/api/visits/referral/:visitId` | upsert `{ referralDate, referralType, illness, duration, reason }` |

---

## Triage

Upsert endpoints (one row per visit):

- **POST** `/api/triage/visual-acuity` — `{ visit_id, left_with_pinhole, left_without_pinhole, right_with_pinhole, right_without_pinhole, notes }`
- **POST** `/api/triage/presenting-complaint` — `{ visit_id, history, red_flags, systems_review, drug_allergies }`
- **POST** `/api/triage/history` — `{ visit_id, past, drug_and_treatment, family, social, systems_review }`

---

## Pharmacy

- **GET** `/api/pharmacy?location_id={id}` → drug rows (`id, drug_name, stock_count, last_updated_at, ...`)
- **GET** `/api/pharmacy/stats?location_id={id}` → `{ total_medications, total_stock, out_of_stock, low_stock }`
- **POST** `/api/pharmacy` — `{ location_id, drug_name, stock_count }` → `201` drug · `409` already exists at location
- **PATCH** `/api/pharmacy/:drugId` — `{ stock_count }` → drug (absolute set — for inventory correction)
- **PATCH** `/api/pharmacy/:drugId/name` — `{ drug_name }` → drug · `409` name taken
- **POST** `/api/pharmacy/:drugId/dispense` — `{ quantity, visit_id? }` → drug (atomic decrement + logged to `dispense_log`)
  · `409 { available }` insufficient stock · `404` unknown drug · `400` bad quantity / unknown `visit_id`
- **DELETE** `/api/pharmacy/:drugId` → `204`

---

## Health

**GET** `/health` → `{ "status": "OK", "timestamp": "..." }` (no auth)

---

## Error shape

```json
{ "message": "..." }   // or { "error": "..." } depending on the route
```

Common statuses: `400` validation, `401` missing/invalid token, `404` not found,
`409` conflict, `500` server error.
