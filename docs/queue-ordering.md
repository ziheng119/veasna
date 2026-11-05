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
- Station cards show **Arrived** with the time the patient reached that station.
- The search icon opens a lookup across the whole clinic queue. Close it or press
  Escape to clear it. Your selected patient stays selected.
- Searching and live updates keep your chosen order.

## Typing a queue number

Leave **Queue Number** blank at registration to get the next number. Type one only to
group patients together:

- `13A`, `13B`: family members or companions of patient 13.
- `A1`, `A2`: a separate lettered series. It never affects the plain numbers.

A typed number can't jump ahead of the next number, because every later patient would
then be numbered after it. If the next number is 14:

| Typed | Result |
| --- | --- |
| `14`, or an unused lower number such as `9` | Accepted. |
| `13A` | Accepted: number 13 already exists. |
| `132` (meant `13A`) | Refused: "ahead of the next number, 14. To group with patient 13, add a letter, e.g. 13A." |
| `20A` | Refused: there is no patient 20 yet. |
| `A12` | Accepted: lettered series are separate. |

An admin correcting a number on **Patient Details** follows the same rule for that
visit's location and date.

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
- `queueNoJumpError` in `apps/backend/utils/queueNumber.js` enforces the typed-number
  rule inside the same lock that issues numbers, so it can't race with another device.
  `apps/frontend/src/lib/queueNumber.ts` mirrors it to show the message before saving;
  a frontend test checks the two give the same answers.

```bash
npm test --workspace apps/frontend
```

For database ordering checks, see [station routing](station-routing.md#technical-details).
