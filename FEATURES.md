# Veasna — Features & Data Flow

Veasna is a screening-clinic record system for mobile/outreach clinics run on a
single host laptop with other devices connected over a local network (LAN).
It captures one **visit** per patient per clinic day and walks that visit
through a fixed set of stations: **Registration → Triage → (Seva / Physiotherapy)
→ Doctor's Consultation → Pharmacy**, with a shared **queue** as the spine that
ties the stations together.

This document describes what the app does today, how data moves through it, and
what a patient's journey looks like end to end. For endpoint-level detail see
[`apps/backend/API_DOCUMENTATION.md`](apps/backend/API_DOCUMENTATION.md); for the
tables see [`apps/backend/db_setup.sql`](apps/backend/db_setup.sql).

---

## 1. The big picture

```
                      ┌─────────────────────────────────────────────┐
                      │        Host laptop (one machine)            │
                      │                                             │
   other laptops      │   Next.js frontend  ──►  Express API  ──►   │
   / tablets  ───────►│   (port 3001)            (port 3000)    Postgres
   on the LAN         │                                             │
                      └─────────────────────────────────────────────┘
```

- **One clinic day = one location + one date.** Staff pick the current
  **location** in the top nav; that choice (and the fetched location list) is
  cached in the browser and **expires at the next 6:00 AM**, so each clinic day
  starts fresh.
- **The queue is per location + per date.** Every station reads the *same*
  queue — the list of visits opened today that haven't been discharged. There is
  no per-station "this patient is now at station X" tracking; the queue is
  simply "who is in the clinic today."
- **A visit accumulates records as it moves.** Registration creates the visit
  row plus vitals and HEF; each later station attaches its own one-row-per-visit
  record (triage, seva, physiotherapy, consultation, referral) and pharmacy
  attaches dispense-log rows. Discharge (`complete`) stamps `completed_at` and
  drops the visit out of the queue — the records are kept.
- **Patients are longitudinal.** A patient row persists across clinic days; each
  day's attendance is a new visit linked to the same patient, so the patient
  detail page shows a full visit history.
- **Everything is attributed.** Every clinical row carries `last_updated_by`
  (the signed-in user) and `last_updated_at`, for audit and for a future sync to
  a central database.

---

## 2. Roles and stations

There is **no role system** in the software — any signed-in user can open any
screen. "Roles" below are organizational, not enforced.

| Station | Screen | What the person does |
|---|---|---|
| **Registration desk** | `/` (Home) | Register the patient, record vitals and HEF status, assign a queue number. |
| **Triage** | `/triage` | Visual acuity (Snellen), presenting complaint, medical history. |
| **Seva** (eye camp) | `/seva` | Repeat/updated Snellen test, eye diagnosis, referral date. |
| **Physiotherapy** | `/physiotherapy` | Notes + pain points marked on a body chart. |
| **Doctor's Consultation** | `/doctors-consultation` | Consultation notes, prescription, and an optional referral letter. |
| **Pharmacy** | `/pharmacy` | Dispense medication against a queued patient; stock decrements atomically and is logged. |
| **Inventory** | `/pharmacy/dashboard` | Add / rename / re-count / delete stock items for the location. |
| **Records** | `/patient-list`, `/patient-details` | Browse patients at the location, view a patient's full visit history, edit demographics. |

Every station screen (`/triage`, `/seva`, `/physiotherapy`,
`/doctors-consultation`) has the same layout: a **queue picker** on the left
(search by queue number or name; a "discharge" ✕ on each row) and the working
panels on the right once a patient is selected. `/seva`, `/physiotherapy` and
`/doctors-consultation` also show **read-only** patient + triage summaries so the
clinician has context without leaving the screen.

---

## 3. A patient's journey

### Step 0 — Staff sign in and set the location

- A user signs in at `/login` with username + password (min 8 chars). New
  accounts can be self-registered from the same screen (unless
  `ALLOW_OPEN_REGISTRATION=false`). The JWT (7-day expiry) is held in the
  browser (`useUserStore`, persisted to `localStorage`). `AuthWrapper` guards
  every `(main)` page and bounces expired/absent tokens to `/login`.
- In the top nav, the user picks the clinic **location** from a dropdown (or
  adds one in edit mode). Until a location is set, station screens show
  "Please set your location."

### Step 1 — Registration (`/`)

The Home screen is a split view: **Today's Queue** on the left, the
**Patient Registration** form on the right.

The form has three tabs:

1. **Patient Info** — queue number (required), sex (required), English name
   (required), Khmer name, date of birth, age (free-text, with a **Calculate**
   button that fills it from the date of birth), phone, address, Face ID
   (optional integer, unique per patient).
   A **"Check Existing"** button searches patients already at this location by
   name and, on a match, fills the form *and links the record* so submitting
   updates that patient instead of creating a duplicate. (Editing the name after
   a match unlinks it again.)
2. **Vitals** — height, weight, BMI (calculated button + category label),
   "below 3rd percentile (BMI-for-age)" checkbox, systolic / diastolic BP,
   temperature, notes.
3. **HEF** — Health Equity Fund questions: does the patient know about HEF, do
   they have HEF, free-text notes on usage.

**Submit & Add to Queue** → `POST /api/visits`. In one transaction the backend:

- inserts the **patient** (or updates it if `patientInfo.id` was linked),
- inserts the **visit** (`patient_id`, `location_id`, `queue_no`, `visit_date =
  today`),
- inserts **vitals** and **hef** rows for that visit.

The queue number must be `digits` + optional letter suffix (`7`, `7A`, `12B`).
A second active visit with the same `(location, date, queue_no)` is rejected
with `409` — one queue number, one patient, per clinic day (the number is freed
for reuse if the first patient is later discharged). A duplicate Face ID is a
distinct `409`.

The new patient immediately appears in **Today's Queue**, sorted by queue
number (`7` before `7A` before `7B` before `12`).

### Step 2 — Triage (`/triage`)

Triage picks the patient from the queue. The panel **loads any triage data
already saved for this visit** and shows a spinner until it does (so a re-save
can't blank existing data). Three tabs, each saved independently:

- **Visual Acuity (Snellen)** — left/right, with/without pinhole, notes →
  `POST /api/triage/visual-acuity` (upsert on `visit_id`).
- **Presenting Complaint** — history of presenting symptoms, red flags, systems
  review, drug allergies → `POST /api/triage/presenting-complaint`.
- **Medical History** — past, drug & treatment, family, social, systems review
  → `POST /api/triage/history`.

### Step 3 — Seva / Physiotherapy (as needed)

**Seva** (`/seva`) — a repeat Snellen ("New Snellen's Test"), an eye
**diagnosis**, a **date of referral**, and notes → `POST /api/visits/seva/:visitId`
(upsert). The screen also shows the read-only patient snapshot and triage
summary.

**Physiotherapy** (`/physiotherapy`) — free-text **notes** plus **pain points**
placed by clicking on a body-chart image (stored as x/y percentages) →
`POST /api/visits/physiotherapy/:visitId` (upsert; pain points are replaced
wholesale on each save).

### Step 4 — Doctor's Consultation (`/doctors-consultation`)

The doctor picks the patient and sees the read-only patient + triage summaries.
They fill:

- **Consultation notes** and **prescription** (free text),
- **Referral needed?** Yes/No.

**Save** → `POST /api/visits/consultation/:visitId` (upsert:
`{ notes, prescription, require_referral }`).

If a referral is needed, a **Referral** form opens: date, one or more referral
targets (Mongkol Borey Hospital, Poipet Referral Hospital, SEVA, Optometrist,
Dentist, Bong Bondol…), a "suffering from ___ for ___" illness/duration line,
and a reason. **Save** → `POST /api/visits/referral/:visitId` (upsert, one
referral per visit). The form can be printed as a referral letter
(`window.print()`).

### Step 5 — Pharmacy (`/pharmacy`)

The pharmacy screen shows the location's medication table + stock stats
(total meds, total stock, out-of-stock, low-stock ≤ 20) and a **Dispense**
panel:

- pick a **medication**,
- optionally pick a **patient** from today's queue,
- enter a **quantity**.

**Dispense** → `POST /api/pharmacy/:drugId/dispense { quantity, visit_id? }`.
The backend does the decrement and the log insert in **one SQL statement**
(`UPDATE … SET stock_count = stock_count - $qty WHERE id = $id AND stock_count
>= $qty` + `INSERT INTO dispense_log …`), so two pharmacists dispensing the same
drug at the same moment can't oversell it. Insufficient stock returns `409` with
the amount available.

If a patient was selected, the dispense is linked to their visit and shows up
later on **Patient Details → Consultation tab → "Medications Dispensed."**
Dispensing without a patient (walk-in, or a stock correction) is allowed.

### Step 6 — Discharge

Anyone can discharge a patient from any queue screen (the ✕ on a queue row,
with a confirm dialog) → `POST /api/queue/:visitId/complete`. This stamps
`completed_at`, removes the visit from the queue, and frees the queue number
for the rest of the day. The visit and all its records remain in the database.

### Later — Records (`/patient-list` → `/patient-details`)

- **Patient List** — all patients at the current location, searchable by name,
  optionally filtered to a specific **visit date**. Rows link to the detail
  page; there's a delete action (confirm dialog → `DELETE
  /api/registration/:id`, cascades to all of that patient's visits and records).
- **Patient Details** — left: editable demographics (`PUT /api/patient/:id`);
  right: the **visit history** (newest first, badges for which stations each
  visit touched). Clicking a visit loads its full detail (`GET
  /api/patient/visit/:id`): vitals, HEF, visual acuity, presenting complaint,
  history, seva, physiotherapy, consultation, referrals, and dispensed meds,
  laid out in Triage / Seva / Physiotherapy / Consultation tabs.

---

## 4. Data model

```
users ──< (last_updated_by on every clinical row)
locations ──< patients ──< visits ──┬─ vitals            (1:1 per visit)
                │                    ├─ hef               (1:1)
                │                    ├─ visual_acuity     (1:1)
                │                    ├─ presenting_complaint (1:1)
                │                    ├─ history           (1:1)
                │                    ├─ seva              (1:1)
                │                    ├─ physiotherapy ──< painpoints
                │                    ├─ consultation      (1:1)
                │                    ├─ referral          (1:1)
                │                    └─ dispense_log      (0:N)
                └─ (a patient belongs to one location)
locations ──< pharmacy ──< dispense_log
```

| Table | Grain | Notes |
|---|---|---|
| `users` | one per login | `username` (case-insensitive unique), `password_hash`, `is_active`. No role column. |
| `locations` | one per clinic site | soft-deleted (`is_active = false`). |
| `patients` | one per person, per location | `face_id` unique when set; `last_updated_by` required. |
| `visits` | one per patient per clinic day | `queue_no`, `visit_date`, `completed_at`. Partial unique index on `(location_id, visit_date, queue_no) WHERE completed_at IS NULL`. |
| `vitals`, `hef`, `visual_acuity`, `presenting_complaint`, `history`, `seva`, `physiotherapy`, `consultation` | **one row per visit** (`visit_id` UNIQUE) | writes are upserts. `ON DELETE CASCADE` from `visits`. |
| `painpoints` | many per `physiotherapy` | x/y as 0–100 percentages. |
| `referral` | one per visit | deleting the `consultation` row also deletes the referral (DB trigger). |
| `pharmacy` | one per (location, drug_name) | `stock_count` integer ≥ 0. |
| `dispense_log` | append-only, one per dispense event | `pharmacy_id`, nullable `visit_id`, `quantity`, `dispensed_by`, `dispensed_at`. |

### Schema evolution

`db_setup.sql` is the current full schema for fresh installs. Incremental
changes live in `migrations/` and are **also applied idempotently at server
startup**:

- `001` — pharmacy `stock_count` (replaced a qualitative stock level)
- `002` — visits `completed_at`
- `003` — the queue-number partial unique index. **Not best-effort**: if active
  visits already collide, the server logs the offending rows and exits.
- `004` — `dispense_log`

---

## 5. Cross-cutting behaviour

### Authentication & attribution
- Username/password, bcrypt-hashed. JWT (7 days) in `localStorage`.
- Every `/api` route except `/api/auth/*` and `/health` requires
  `Authorization: Bearer <token>`.
- No RBAC — deliberately (see `AGENTS.md`). Attribution (`last_updated_by`) is
  the point, not access control.

### Location & the clinic day
- The location list and current selection are cached in the browser and the
  whole cache **expires at the next 6:00 AM**, forcing a re-pick each clinic
  day.
- Queue and patient/stock data are keyed by the current location; changing
  location re-fetches everything.

### The queue
- `GET /api/queue?location_id=&date=YYYY-MM-DD` returns visits with
  `completed_at IS NULL`, oldest first, with `queue_no`, names, sex, age
  (computed), and a check-in time.
- The frontend sorts by queue number: numeric part first, then a bare number
  before its lettered variants, then suffix (`lib/queueOrder.ts`).
- Discharge is idempotent.

### Offline / LAN
- Backend and frontend bind all interfaces; clients use the host's LAN IP.
- **CORS** reflects the request origin by default (`CORS_ALLOWED_ORIGINS` to
  restrict).
- The frontend derives the API base URL from the page's own host at runtime, so
  nothing needs rebuilding when the host IP changes.
- `OFFLINE_MODE=true` disables the general rate limiter (the auth limiter stays
  on).

### Resilience & caching
- Read endpoints (`/api/patient/:id`, `/api/patient/visit/:id`, consultation)
  support `ETag` / `If-None-Match`.
- The frontend API layer keeps small in-memory caches per resource and, on a
  network error, falls back to the last good value where it can. (These caches
  are hand-rolled and slated for replacement — see Limitations.)

### Desktop
- `apps/desktop` is an Electron window pointed at the running frontend. It does
  not yet package installers or launch the backend itself.

---

## 6. Known limitations / not yet built

- **No "new visit for an existing patient" flow.** A returning patient is
  registered from the Home form; "Check Existing" links the record so it isn't
  duplicated, but there's no "start today's visit for this patient" button on
  the patient list.
- **Identity confirmation on "Check Existing" is shallow** — editing the name
  after a match unlinks it, but editing only DOB/phone does not.
- **No per-station progress tracking.** The queue can't show "waiting for
  doctor" vs "in triage"; it's a flat list until discharge.
- **Prescription ↔ pharmacy is loose.** The consultation prescription is free
  text; dispensing is recorded separately (and only linked to the visit if the
  pharmacist selects the patient).
- **Hand-rolled fetch caches.** The per-module caches with manual ETag handling
  are fragile; a move to a query library (or removing them, given the tiny data
  volumes) is planned as its own change.
- **Desktop packaging / bundled backend / offline installers** are roadmap
  items (see `apps/frontend/README.md`).
- **Sync to a central database** is designed for (attribution, timestamps) but
  not implemented.
