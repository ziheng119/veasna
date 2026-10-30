# Returning to and skipping stations

While a patient is in the clinic, an admin can change which stations they still go
to, and in what order. (To change how a queue is sorted, see
[queue ordering](queue-ordering.md).)

## How to use it

Press **Stations** on a patient in a station queue:

- **Return to [station]** reopens a station the patient has finished and makes it next.
- **Skip for now** moves a station to the end of the route. It isn't marked as done.
- **Up / Down** reorders the remaining stations.
- **Add [station]** adds a station; **Remove** takes it off the remaining route.
- **Save** applies the new route and sends the patient to its first station.
  **Cancel** changes nothing.

**Example:** a patient is due at Seva, then Consultation. Choosing **Skip for now** on
Seva sends them to Consultation first. When Consultation is finished, they go back to
Seva. You could also add Triage at the front for a repeat check.

Good to know:

- Forms and notes already saved at a station are kept when the patient returns to it.
- Finishing the last station still completes the visit.
- A discharged visit can't be reopened here. Register a new visit if the patient comes back.
- **TB Tent** must stay first until the patient is cleared, and can't be skipped or
  removed. Sending a patient back to TB Tent puts them on TB hold again until a new
  TB review.
- If someone else changed the route while you had the dialog open, saving shows a
  conflict message. Close the dialog and open it again to see the current route.

## Technical details

`visit_stations.position` holds each visit's own route. Finishing a station or clearing
TB moves the patient to the next unfinished station by position.

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
npm test --workspace apps/backend -- --runInBand tests/stationRoute.test.js tests/realtime.test.js
npm test --workspace apps/frontend
```

Database checks, using temporary tables only (PowerShell):

```powershell
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand tests/stationRoute.database.test.js
Remove-Item Env:RUN_DB_TESTS
```

Manual check with two signed-in devices: skip a station on one, and confirm the other
shows the new next station. Finish that station and confirm the skipped one comes back.
Also try reopening a finished station, and saving from a dialog that is out of date.
