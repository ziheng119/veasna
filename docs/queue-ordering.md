# Queue display ordering

Each queue has a full-width glass-style **Queue number / Arrival time** control
labelled **Sort queue by** above its search field, with equal-width options.
The glass highlight slides between options; sorting updates immediately.
Reduced-motion settings disable the slide and colour transitions.
The separate overall-queue lookup opens from a search icon; closing it or pressing
Escape collapses and clears the lookup without clearing the selected patient.
The lookup's circular outline expands into the search field, keeping the same icon.
This animation respects reduced-motion settings. Scrollbars use transparent tracks
and rounded thumbs where supported, with native thin scrollbars in Firefox.
Home defaults to Queue number; station queues default to Arrival time. Choices are
saved per user, backend, and queue in this browser's local storage. They survive
navigation/reloads and do not affect another user's view, routing, or patient records.
Other tabs for the same user and queue follow saved preference changes.

- **Queue number:** numeric registration number, then suffix: `2, 2A, 2AA, 2B, 10`.
  Equal numbers retain arrival order. Unknown formats follow valid numbers.
- **Arrival time:** preserves the API's earliest-first order. Home uses clinic
  registration time; each station uses when the patient entered its current station.
  Ties use visit ID. Returning patients join behind those already waiting there.

An earlier-numbered returning patient may appear first in Queue number mode even if
others have waited longer at that station. This toggle is a display preference, not
an instruction to change clinical priority.

Search filters and live refreshes keep the selected mode. Sorting copies the list,
never mutating shared data. Arrival mode does not parse clock labels or rely on client
clock/timezone settings. Station cards show **Arrived** with the server-formatted
station arrival time. Older servers without this additive field show **Registered**
with the original timestamp instead. Home continues to show registration time.

## Implementation

- `queueSort.ts`: shared deterministic number sorting; preserves API order for arrivals.
- `useQueueSort.ts`: user/page preference storage, safe defaults, and blocked-storage fallback.
- `QueueSortControl.tsx`: keyboard-accessible buttons with `aria-pressed` state.
- `GET /api/queue`: adds `station_arrival_time`; retains `timestamp` and existing ordering.
  Missing station arrival timestamps fall back to visit creation time, matching the SQL sort.

No schema migration is needed for this change. Restart the backend to serve the additional
field. If storage is unavailable, switching modes still works for the mounted page.

## Checks

```bash
npm test --workspace apps/frontend -- --runInBand
```

The tests cover numeric/suffix sorting, source-array preservation, defaults, remounts,
user/station isolation, invalid or blocked storage, cross-tab changes, search, and live updates.
For PostgreSQL ordering/display checks, run the temporary-table integration tests described
in [station routing](station-routing.md#setup-and-validation). They verify clinic versus
station arrival, tie-breaking, and fallback timestamps without touching clinic records.
