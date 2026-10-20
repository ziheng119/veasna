# Returning to and deferring stations

This change controls the order of stops for an **active visit**. It does not change
how patients are sorted within a queue; arrival-order sorting is a separate task.

## Clinic workflow

Open **Stations** on a patient in a station queue:

- **Return to [station]** reopens a completed station and places it next.
- **Skip for now** moves a pending station to the end. It is not marked completed.
- **Up / Down** changes the order of the remaining stops.
- **Add [station]** adds a stop; **Remove** drops it from the remaining route.
- **Save** applies the plan and moves the patient to its first stop. Cancel does nothing.

Example: Seva ? Consult becomes Consult ? Seva when Seva is skipped for now.
Completing Consult then sends the patient back to Seva. A completed Triage can also
be added ahead of those stops for a repeat assessment.

Clinical forms and notes are retained when revisiting a station. A station occurs once
in the remaining plan; it can be reopened again after completion. Finishing the last
pending stop still ends the visit. Completed/discharged visits cannot be reopened by
this editor; register a new visit if the patient returns after discharge.

TB Tent must remain first while pending. It cannot be skipped or removed during a TB
hold. Returning to a completed TB Tent flags the visit as suspected again and requires
a new TB review before proceeding.

## Implementation and concurrency

`visit_stations.position` now represents a visit-specific route, rather than a fixed
station rank. Registration retains its default order. Station completion and TB clearance
already select the next pending stop by position and therefore follow the edited route.

`PUT /api/queue/:visitId/stations` accepts:

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

The server locks the visit in the same transaction used for routing edits. If pending
order or completion state differs from the submitted snapshot, it returns HTTP 409:
close and reopen the dialog to review the current route. This is a route-state check,
not versioning of clinical form edits. Legacy requests without `ordered` retain completed
stations, preserve pending order, and append newly selected stations (TB stays first).

Before changing the route, `visit_station_route_history` records the previous rows,
requested route, user, and timestamp in the same transaction. This preserves earlier
completion/arrival timestamps when a station is reopened or removed. Visit and station
update metadata is maintained. Audit failure rolls back the route change.

The current station keeps its arrival timestamp if it remains current. When moving to
another stop, that stop receives a new arrival timestamp; deferred stops receive theirs
when they become current again. Queue sorting logic is unchanged. Successful writes use
the existing Socket.IO notification to refresh other users' lists.

## Setup and validation

Restart the backend to apply idempotent migration `010_station_route_history.sql` through
the existing startup migration runner. Fresh installs include the table in `db_setup.sql`.
Do not rerun that bootstrap script on an existing database. If startup reports a migration
warning, resolve it before editing routes; audit writes must succeed.

```bash
npm test --workspace apps/backend -- --runInBand tests/stationRoute.test.js tests/realtime.test.js
npm test --workspace apps/frontend -- --runInBand
```

Optional PostgreSQL integration checks (PowerShell, using backend `.env` credentials):

```powershell
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand tests/stationRoute.database.test.js
Remove-Item Env:RUN_DB_TESTS
```

Integration tests use session-local temporary tables with `search_path=pg_temp`; clinic
records are not touched. Check two signed-in clients manually: defer a stop on one, confirm
the other sees the new destination, complete that stop, and confirm the deferred stop
returns. Also test reopening a completed station and saving an outdated open dialog.
