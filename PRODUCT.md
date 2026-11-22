# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Visiting volunteers on Project Battambang screening trips in rural Cambodia: mostly medical,
dental and pharmacy students, with supervising doctors. Many use Veasna for only a few days
per trip, so they learn it on the spot, often from the in-app guided tour.

Each person works one station (Registration, Triage, Dental, Consult, Physiotherapy, Partner
NGO or Pharmacy) and moves patients through that station's queue while patients wait in front
of them. One admin sets the day up: creates the screening-day account, its permissions and
the station data.

Patients don't use the screens. Staff read English.

## Product Purpose

Veasna is the patient screening system for Project Battambang's community health
screenings. It records registration, each station's findings, referrals and prescriptions,
and moves every patient through the day's station queues to Pharmacy.

Success: every patient seen that day is registered once, reaches the stations they need,
gets their prescription from real pharmacy stock, and leaves a complete, correctly
attributed record that later trips can find and that can be merged into a central database.

## Positioning

It runs a whole screening day on one host laptop and a local router, with no internet.
Every device opens the host's address in a browser and sees the same live queues. Weak Wi-Fi,
a dropped connection or a device with the wrong clock don't lose work or corrupt the
day's records.

## Operating Context

- A pop-up clinic in a village: a host laptop (database, server, web app) plus staff
  laptops and tablets on the same Deco router mesh, opening `http://<host-IP>:3001`.
  An optional Electron desktop window wraps the same web app.
- Wi-Fi can be weak. Typing is kept on each device, an amber bar shows when the host
  can't be reached, and lists and forms reload once it can.
- The host's clock defines "today". Devices whose clock is more than 5 minutes off show
  a yellow warning.
- One shared screening-day account per day (e.g. `dec13village`), plus the admin. The
  village is part of the account's username.
- Patients carry a coloured sticker and a queue number. Families are grouped and move
  between stations together.
- Suspected TB patients (3 or more red flags) go only to Consult, are marked red in every
  queue, and are seen in a separate TB tent.
- Printed referral letters carry the Project Battambang letterhead and are signed by
  the doctor.
- After each clinic the database is backed up to a USB stick. The server also saves a
  backup every 2 hours.

## Capabilities and Constraints

- Pages: Patient List, Registration with Today's Queue, Patient Details, Triage, Dental,
  Consultation, Physiotherapy, Partner NGO (internally `seva`; the display name is set in
  `apps/frontend/src/constants/partnerNgo.ts`), Pharmacy and its Dashboard, Analytics, Station
  data, Accounts.
- Core workflows must work with no internet: no CDNs, cloud services or external sign-in.
  Fonts and images are served by the host.
- Lightweight username/password sign-in only, for attribution. Permissions are ticked per
  screening-day account, not complex role-based access. Buttons an account can't use are
  not shown.
- Every record keeps accurate `last_updated_by` and timestamps for a future sync to a
  central database. Changes must stay backward-compatible with existing data.
- Destructive actions (delete, remove, discharge) always ask first in a pop-up that says
  what will happen.
- Queues, lists and open forms update on every device when anyone saves.
- Stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 and shadcn/ui
  components; Express and PostgreSQL backend; optional Electron wrapper.

## Brand Commitments

- Organisation: Project Battambang, "Community health screening". Its butterfly logo is
  at `apps/frontend/public/btb-logo.png` and prints on referral letters.
- The product name is Veasna.
- The partner NGO's name can change, so UI copy uses the configured name, never a
  hard-coded one.
- UI font chosen by the user: TeX Gyre Heros (a free Helvetica lookalike, in place of
  the licensed Helvetica World), bundled in `apps/frontend/public/fonts/` so it works offline.

## Evidence on Hand

- Real workflows and rules are documented in `README.md` and `docs/`.
- Sample patients and pharmacy stock for practice come from `npm run seed:demo`. The
  guided tour uses its own sample patient (`apps/frontend/src/lib/guide/sample.ts`).
- There are no testimonials, outcome figures or published case studies. Don't invent any.

## Product Principles

1. **The clinic day must not stop.** Offline, weak Wi-Fi and wrong clocks are normal
   conditions, not edge cases. Every flow must fail visibly and recover by itself.
2. **Learnable in minutes.** A volunteer who arrived yesterday should finish their
   station's task without training. Plain words, one obvious next step, the guided tour
   for the rest.
3. **The patient in front of you comes first.** Queue and form screens favour speed and
   scanning while a patient waits: the current patient, their flags (TB, family, sticker)
   and what to do next.
4. **Records are permanent and attributed.** Who entered what, and when, must stay right,
   because the data outlives the trip and will be merged into a central database.
5. **Ask before destroying.** Anything that deletes, removes or discharges states its
   effect and waits for confirmation.

## Accessibility & Inclusion

UI is English only; staff read English. No other product-specific accessibility
requirement has been set yet. Devices are a mix of laptops and tablets, so screens must work
with touch as well as mouse.
