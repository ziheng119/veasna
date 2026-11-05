# Returning to and skipping stations

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
  Consultation first (see below).
- If someone else changed the route while you had the dialog open, saving shows a
  conflict message. Close the dialog and open it again to see the current route.

## Suspected TB patients

A patient with TB red flags is kept apart in the TB tent, and a doctor goes to see them
there. Veasna follows that:

1. **Flag:** tick **3 or more** TB red flags at registration, or press **Flag suspected
   TB** at Triage and tick 3 or more. With fewer, the patient isn't flagged and goes
   through their stations as usual; the form shows how many are ticked. The patient goes **straight to the Consult queue**, shown in red with a
   **TB** label in every queue. Their other stations (e.g. Triage, Partner NGO) stay on
   their route, after Consultation.
2. **Clear:** once the doctor has seen them, anyone presses **Clear TB** on the patient's
   queue card (Home or any station queue), or **Clear TB flag** at Triage. The red marker
   goes and the patient is in the Consult queue, since the tent visit is their
   consultation.
3. **Consult as usual:** the doctor writes the consultation notes and presses **Next**
   or **Finish**. Use **Send to** to remove stations the patient no longer needs.

Good to know:

- Clearing someone who isn't at Consultation (e.g. flagged before this update) sends
  them there too. A finished Consultation isn't reopened, and a discharged visit stays
  discharged.
- If two people clear the same patient, the second press changes nothing.
- Only an admin can change the red flags or notes of an existing flag (on **Patient
  Details**). That never moves the patient.

## Technical details

`visit_stations.position` holds each visit's own route. Finishing a station moves the
patient to the next unfinished station by position. Flagging or clearing TB makes
Consultation the current station (`sendToConsultation` in `apps/backend/utils/tb.js`),
recorded in `visit_station_route_history` like any route change.

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
