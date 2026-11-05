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

To show that patients came together, group them into a **family**. Everyone in a
family shares a letter on the end of their number:

1. Register each family member as usual, e.g. mother 3, father 4 and child 5.
2. On **Patient List**, find the father and press the **Add to family** icon (people)
   on his row. It opens a small search of today's queue.
3. Type the mother's name or number and pick her. Both get the next free family letter:
   3A and 4A.
4. Do the same for the child, picking the mother or father: the child joins their
   family as 5A.

The next family that day gets B, then C, and so on (after Z: AA, AB...). Each
location and day starts again at A. Picking someone already in a family adds the
patient to that family. To undo a mistake, open the patient's **Add to family** search
and press **Remove from family**: 4A becomes 4 again; the rest of the family keeps
its letter.

Only today's visits at the same location can be grouped. Older numbers that start
with a letter (such as A12) can't join a family; an admin can correct them on
**Patient Details**, where a corrected number can't jump ahead of the next number
either.

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
- Families are read from the queue number itself (`utils/family.js`); grouping takes the
  same lock, so two devices can't start two families with the same letter.
- `queueNoJumpError` in `apps/backend/utils/queueNumber.js` checks admin corrections on
  Patient Details.

```bash
npm test --workspace apps/frontend
```

For database ordering checks, see [station routing](station-routing.md#technical-details).
