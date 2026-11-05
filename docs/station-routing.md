# Stations, returning to and skipping them

## Stations and their order

Patients go through the stations they need in this order:

| Station | Who sends the patient there |
| --- | --- |
| Triage | Ticked at registration |
| Consult | Ticked at registration |
| Physiotherapy | The doctor, with **Send to Physiotherapy** on the Consult page |
| Dental | Ticked at registration |
| Partner NGO | Ticked at registration, or added at Triage when a cataract is suspected |
| Pharmacy | Added automatically when the doctor prescribes something |

- **Dental** shows the patient's triage notes, where tooth problems found at Triage are
  written. The students note what they did and tick **Referral needed** if the patient
  should go to hospital. The doctor sees both on the Consult page, under **Dental notes**,
  and makes the referral from there.
- **Pharmacy** has its own queue on the Pharmacy page. Picking a patient shows only their
  prescriptions; once they are dispensed, press **Finish** to complete the visit. A
  patient with no prescription finishes at their last station.
- A station added later (Physiotherapy, Partner NGO, Pharmacy) goes in its place in this
  order, never ahead of the station the patient is waiting at, and keeps any custom order
  made with **Send to**.

## Finishing at a station

A patient is **done** at a station once everything needed there is saved:

| Station | Done when |
| --- | --- |
| Triage | All three sections are saved: Visual Acuity, Presenting Complaints and Medical History |
| Consult, Physiotherapy, Dental, Partner NGO | The station's notes are saved |
| Pharmacy | Nothing is left to dispense (every prescription dispensed or cancelled) |

- Their card in the station queue then shows a green **Done here**, and the form shows
  **Done at [station]** with a **Send to next station** button.
- **Save & next**, beside each form's Save, does it in one go: it saves the form, sends
  the patient to their next station (or finishes their visit after the last one), and
  opens the next patient waiting in this queue, in the order shown.
- At Triage, **Save & next** on any section saves that section, then names any other
  section still to be saved instead of moving the patient on.
- At Consult, prescribe and tick **Send to Physiotherapy** before **Save & next**, so the
  patient goes to the right place.
- A form that is already saved can't be saved again by a user, so use **Send to next
  station** (or **Next** on the card) for it.

While a patient is in the clinic, anyone signed in (user or admin) can send them to
the next station, change which stations they still go to and in what order, or
discharge them. (To change how a queue is sorted, see
[queue ordering](queue-ordering.md).)

## How to use it

Press **Send to** on a patient in a station queue:

- **Return to [station]** reopens a station the patient has finished and makes it next.
- **Skip for now** moves a station to the end of the route. It isn't marked as done.
- **Up / Down** reorders the remaining stations.
- **Add [station]** adds a station; **Remove** takes it off the remaining route.
- **Save** applies the new route and sends the patient to its first station.
  **Cancel** changes nothing.

**Example:** a patient is due at Partner NGO, then Consultation. Choosing **Skip for now** on
Partner NGO sends them to Consultation first. When Consultation is finished, they go back to
Partner NGO. You could also add Triage at the front for a repeat check.

Good to know:

- Forms and notes already saved at a station are kept when the patient returns to it.
- Finishing the last station still completes the visit.
- A discharged visit can't be reopened here. Register a new visit if the patient comes back.
- Suspected TB is not a stop. It is a flag on the visit that sends the patient to
  Consultation only, and their route can't be changed (see below).
- If someone else changed the route while you had the dialog open, saving shows a
  conflict message. Close the dialog and open it again to see the current route.

## Suspected TB patients

A patient with TB red flags is kept apart in the TB tent, and a doctor goes to see them
there. Veasna follows that:

1. **Flag:** tick **3 or more** TB red flags at registration, or press **Flag suspected
   TB** at Triage and tick 3 or more. With fewer, the patient isn't flagged and goes
   through their stations as usual; the form shows how many are ticked.
2. **Consult only:** a flagged patient goes **straight to the Consult queue**, shown in
   red with a **TB** label in every queue. Consult is their only station: any others
   (Triage, Dental, Partner NGO) are taken off their route, the registration form doesn't
   offer them, and the doctor can't send them to Physiotherapy. If the doctor prescribes,
   Pharmacy is added after Consult as for any patient.
3. **Clear:** the doctor who sees them in the TB tent presses **Clear TB** on the
   patient's card in the **Consult** queue and confirms in the pop-up. The red marker
   goes; the patient stays in the Consult queue. Clear TB isn't offered on Home, at
   Triage or in other queues.
4. **Next:** the doctor writes the consultation notes, prescribes, and presses **Next**.
   The patient moves to the Pharmacy queue for their prescriptions (or, with nothing
   prescribed, **Finish** ends their visit).

A TB patient's stations can't be changed, before or after the flag is cleared, so
**Send to** is greyed out on their card. **Finish** and **Discharge** still work.

Good to know:

- The flag can only be cleared while the patient is waiting at Consult; the server
  refuses it anywhere else, for admins too. An admin can correct the flag of a finished
  or discharged visit on **Patient Details**. Clearing also removes any other stations
  left on an older visit's route.
- Flagging a patient whose Consultation is already finished doesn't reopen it.
- If two people clear the same patient, the second press changes nothing.
- Only an admin can change the red flags or notes of an existing flag (on **Patient
  Details**). That never moves the patient.
- A patient flagged by mistake still goes to Consult only. The doctor can **Finish**
  them; register a new visit if they need other stations.

## Technical details

`visit_stations.position` holds each visit's own route. Finishing a station moves the
patient to the next unfinished station by position. Flagging or clearing TB makes
Consultation the only unfinished station (`TB_ROUTE` and `sendToConsultation` in
`apps/backend/utils/tb.js`), recorded in `visit_station_route_history` like any route
change. `PUT /api/queue/:visitId/stations` returns HTTP 409 for any visit with a TB
record (flagged or cleared), for admins too.

`PUT /api/queue/:visitId/stations` takes the new route and the route the dialog
started from:

```json
{
  "stations": ["consultation", "seva"],
  "ordered": true,
  "expected_stations": [
    { "station": "triage", "completed": true },
    { "station": "seva", "completed": false },
    { "station": "consultation", "completed": false }
  ]
}
```

- The visit is locked during the change. If its route no longer matches
  `expected_stations`, the server returns HTTP 409.
- Requests without `ordered` (older clients) keep finished stations and the existing
  order, and add new stations at the end, with TB still first.
- Before each change, `visit_station_route_history` records the old route, the new
  route, who changed it and when. If that record can't be saved, the change is undone.
- The current station keeps its arrival time if it stays current. A station gets a new
  arrival time when the patient moves to it.
- Other devices refresh through the usual live updates.

The history table is created automatically when the server starts (migration
`010_station_route_history.sql`). If start-up logs a migration warning, fix it before
editing routes.

```bash
npm test --workspace apps/backend -- --runInBand tests/stationRoute.test.js tests/realtime.test.js tests/tbRegistration.test.js
npm test --workspace apps/frontend
```

Database checks, using temporary tables only (PowerShell):

```powershell
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand tests/stationRoute.database.test.js tests/tbFlow.database.test.js
Remove-Item Env:RUN_DB_TESTS
```

Manual check with two signed-in devices: skip a station on one, and confirm the other
shows the new next station. Finish that station and confirm the skipped one comes back.
Also try reopening a finished station, and saving from a dialog that is out of date.
