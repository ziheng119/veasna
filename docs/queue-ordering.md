# Queue ordering

Each queue has a **Sort queue by** switch above its search box:

- **Queue number:** in registration number order, with letter suffixes after their
  number: `2, 2A, 2AA, 2B, 10`. Numbers that start with a letter come after the plain
  numbers, in their own series: `A1, A2, A12, B1`. Letter case is ignored. Patients with
  the same number stay in arrival order.
- **Arrival time:** whoever has waited longest comes first. On Home this is when the
  patient registered; at a station, it is when they arrived at that station. A patient
  sent back to a station joins behind those already waiting there.

Home starts on **Queue number** and station queues start on **Arrival time**. Your
choice is remembered on this browser, for your account and that queue only. It
doesn't change anyone else's view or the patient's route.

This switch only changes how the list is shown. It is not a priority setting: in
Queue number order, a returning patient with a low number may appear above people who
have waited longer.

## Using the queue

- Click anywhere on a patient card in a station queue to select the patient. The
  buttons on the card (**Next/Finish**, **Send to**, **Discharge**) work separately.
- On **Home**, clicking a patient in **Today's Queue** opens the station they are
  waiting at, with them already selected.
- Suspected TB patients' cards are red. When hovered or selected they turn a darker
  red, instead of the blue other cards use.
- Station cards show **Arrived** with the time the patient reached that station, and a
  green **Done here** once everything needed at the station is saved (see
  [finishing at a station](station-routing.md#finishing-at-a-station)).
- The search icon opens a lookup across the whole clinic queue. Close it or press
  Escape to clear it. Your selected patient stays selected.
- Searching and live updates keep your chosen order.

## Queue numbers and families

Queue numbers are given automatically: 1, 2, 3... per location each day. The
registration form shows the number the next patient will get. It updates by itself
when someone registers a patient on another device, and the number actually given is
shown once you submit.

To show that patients came together, group them into a **family**. A family has its
own letter (A, B, ... Z, then AA, AB...); queue numbers don't change:

1. Register each family member as usual, e.g. mother 3, father 4 and child 5.
2. On **Patient List**, press the **Add to family** icon (people) on the father's row.
   A pop-up opens over the list, and his row is highlighted so you can see who it is
   about.
3. Under **Start a family with**, search for the mother by name or number and pick
   her. Both are now in the next free family, e.g. family A: still numbers 3 and 4.
4. Open the child's pop-up and pick family A under **Join a family** (search by name,
   number or the letter): the child joins it, still number 5.

Any of today's families can be joined, whichever member was registered first. The
next family that day gets the next letter; each location and day starts again at A.
Picking someone who isn't in a family while the patient is in one adds them to the
patient's family. To undo a mistake, open the pop-up and press **Remove from family**;
the rest of the family stays together.

Where families are shown:

- Every queue shows the queue number with a small coloured family badge (e.g. **A**)
  beside it, and puts the family's members together where its first member is, in
  either sort order. The colour is the same wherever the family appears.
- **Patient List** puts family members side by side (for today, or the date filtered),
  with a coloured stripe down the left edge and the family badge after the name. Rows
  keep their usual size.

Families move between stations together: see
[families](station-routing.md#families-move-together).

Only today's visits at the same location can be grouped.

## Technical details

- `queueSort.ts` sorts queue numbers; arrival order is kept exactly as the server
  sends it. Sorting works on a copy, never the shared list.
- `useQueueSort.ts` saves the choice in local storage per user, server and queue. Other
  tabs follow changes. If storage is blocked, the switch still works until the page
  is reloaded.
- `QueueSortControl.tsx` is the switch, usable by keyboard. Its animations are
  turned off when the device asks for reduced motion.
- `GET /api/queue` returns `station_arrival_time`. If a visit has no station arrival
  time, the server falls back to when the visit was created. Older servers without
  this field make cards show **Registered** instead of **Arrived**.
- Arrival order never depends on device clocks.
- Registration takes the location's queue lock (`lockQueue`) before reading the next
  number, so two devices registering at once never get the same number. A
  `visit.queue_no` sent by an older app is ignored.
- Families are kept in `visits.family` (migration `019_visit_families.sql`). Grouping and
  moving families take the location's family lock (`lockFamilies` in
  `utils/familyMoves.js`), so two devices can't start two families with the same letter.
  Numbers grouped the old way (`3A`) were changed to 3 in family A, unless the plain
  number was already used that day.
- `groupFamilies` in `apps/frontend/src/lib/family.ts` keeps families together in queues
  and on Patient List.
- `queueNoJumpError` in `apps/backend/utils/queueNumber.js` checks admin corrections on
  Patient Details.

```bash
npm test --workspace apps/frontend
```

For database ordering checks, see [station routing](station-routing.md#technical-details).
