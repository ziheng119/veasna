# Analytics

Open **Analytics** from the account menu (your username, top right). The **admin** can,
and so can screening-day accounts with the **Analytics** permission. It shows clinic
numbers for a time period. Apart from the referral lists (below), it
contains no patient names, IDs, notes or signatures.

## Using the page

Analytics sits inside the app, under the same top bar as the stations. It is for two jobs:
closing a clinic day (who is still in the clinic, which referrals need a signature) and
reporting on a trip afterwards.

- **Filters:** choose a period (**Day**, **Week**, **30 days**, **This trip** or **Overall**)
  and the end date. Every number, chart and list on the page covers these dates. The
  filters are kept in the address (e.g. `/analytics?period=trip&date=2026-11-18`), so a view
  can be bookmarked, reloaded or opened on another laptop on the LAN. While new numbers
  load, the old ones stay on screen, dimmed.
- **This trip** is the run of clinic dates leading up to the end date, with no more than 3
  days between one clinic date and the next. A longer gap starts a new trip. A trip report
  also shows **By clinic day**: each date with its screening-day account (named for the
  village, e.g. `dec13village`), patients, consultations and referrals.
- **Summary** opens with one sentence for the period, e.g. *Today, 42 patients were
  reached and 30 consulted; 8 visits have a referral (2 unsigned); 5 still in the clinic.*
  On today's **Day** view, **Station workload** follows straight after, since that is where
  patients are waiting now.
- **Needs follow-up** names the visits not yet discharged (with the station each is at)
  and the referrals saved without a signature, with the same TB, family and sticker
  markers as the queue. Pressing a name opens the patient's record. Today these patients
  are *still in the clinic*; on a past date they are visits that were *not discharged*.
  While either list has anyone on it, the card's border pulses red. An unsigned referral
  links to where it is signed: **Sign at Consult** (the patient is waiting at Consult today;
  their referral opens) or **Sign in record** (that visit's Consultation tab in the patient's record, with the referral form open). The
  referral form fills in the account's saved signature when the referral has none.
- **Printing referral letters:** press **Print referral letters** on the **Visits with
  referrals** card to print saved referral letters for today, a date, a period or all
  dates. This needs the **Print and download** permission too. See
  [printing saved referrals](consultation-referrals.md#printing-saved-referrals).
- **Section links** under the filters jump to Summary, Follow-up, Trends, Conditions,
  Referrals, Partner NGO, Optician and Clinic operations, and show which one you are reading.
- **Partner NGO referrals** lists the patients the Partner NGO station marked as
  **Referral needed**, one table per referral type, with the referral date,
  visit date, names, markers, sex, date of birth, phone and diagnosis. It has its own dates,
  separate from the page's time period: **Today**, **This week** (today and the 6 days
  before), **All time**, or **Choose dates** (from and to, by visit date). It is the
  station's **Referral list** pop-up for those dates; the types are edited on
  [Station data](station-data.md).
- **Optician referrals** lists the patients Triage marked **Suspected cataract** → **Refer to optician** for (under
  the visual acuity), newest visit first: name, markers, sex, date of birth, phone,
  address, and the Snellen readings taken (L left eye, R right eye) with the Triage notes.
- **Referral lists:** under **Patients by referral destination**, each destination shows
  how many patients were referred there, as a bar. Pick one to list its patients,
  numbered in the order they were seen: name (English and Khmer), TB, family and sticker
  markers, age and sex, queue number, visit date, phone, address and the reason for
  referral. Unsigned drafts are marked. **Print list** prints the chosen destination;
  **Print referrals** prints the saved referral letters of the patients on it, one per page;
  **Print all lists** prints every destination with patients, one per page, to take on
  referral days. Every current destination is listed, even with no patients; names saved
  on older referrals that are no longer on the list appear after them.
- **ⓘ buttons** explain what each number means. Hover over one to preview it, or tap
  it to keep it open.
- **Refresh** reloads the latest saved data.
- **Export** downloads a spreadsheet (CSV) or prints a one-page **report** (A4, no patient
  names): the summary sentence, totals, clinic days, conditions, ages, referral
  destinations and station workload. Both work without internet.
- Charts can be read by hovering, tapping or using the arrow keys. Each has a **Show as
  table** option. Trend lines differ by dash pattern as well as colour.
- If nothing matches, the page offers a longer period, or all time, with one click.

## What the numbers mean

The period counts visits by **visit date**. "Week" is the end date plus the 6 days
before it; "30 days" is the end date plus the 29 before it; "This trip" is described above;
"Overall" is every date up to the end date. Numbers show each visit's **current** saved
state, not a snapshot from the end of that day. Dates are written like *18 Nov 2026*.

| Number | Meaning |
| --- | --- |
| Patients reached | Different patients seen. A patient who came twice counts once. |
| Patients consulted | Patients whose Consultation station is marked finished. Only saving notes doesn't count. |
| Visits with referrals | Visits with a saved referral, including unsigned drafts. |
| Visits discharged | Visits marked as discharged. This doesn't mean every station was done. |
| Station workload | Stations assigned and finished. The last column is **Waiting** on today's Day view (the visit is at that station now) and **Not discharged** otherwise (the visit was left open there). Pharmacy is added when the doctor prescribes, and is finished once every prescription is given out. |
| By clinic day | Patients, consultations and referrals for each clinic date. Patients count once per day, so the rows can add up to more than Patients reached. |
| Age groups | Patients by age on the end date. Missing or future birth dates show as Unknown. |
| Patients by referral destination | Referred visits for each destination. One referral can choose several, so a patient can be in more than one list and the lists can add up to more than Visits with referrals. A name differing only in capitals or spacing (e.g. `OPTICIAN`) counts under the current choice. |
| Conditions | Consulted patients for each condition the doctor ticked. A patient can count under several conditions. A consultation counts as *recorded* once a condition or **None** is ticked. |
| Condition mix (pie) | Each condition's share of all ticked conditions, not of patients. The centre shows the total. |
| Documentation checks | Consultation notes written, referrals not yet signed, and missing or future birth dates. These are reminders to review, not quality scores. |

**Trends** show patients reached and consulted, or conditions, over the period: the 7
days up to the date for a Day or Week (for context), 30 days for 30 days, each date of a
trip (at least 7 days; a trip over 31 days by week), and 12 months for Overall. Each point
counts patients within that day, week or month only, so don't add the points together.

The CSV contains the filters, summary, conditions, age groups, station workload,
referral destinations, clinic days, documentation checks and the trend. It opens in Excel
with Khmer text intact.

## Ideas for later

These need new or checked data before they can be shown:

1. **New vs known conditions:** whether a condition was found at this visit.
2. **Referral outcomes:** whether referred patients attended and what happened.
3. **Reach:** which communities are reached, and new vs returning patients.
4. **Supplies:** medicine dispensed, prescriptions that couldn't be filled and stock-outs.

## Technical details

- `GET /api/analytics?date=YYYY-MM-DD&period=day|week|month|trip|all`
  returns the summary (the default period is `day`), with `startDate` (worked out on the
  host for a trip) and `days`, one row per clinic date.
  `GET /api/analytics/trend?date=YYYY-MM-DD&period=...` returns trend points for the
  period, with their `unit` (day, week or month). The older
  `GET /api/analytics/trend?date=YYYY-MM-DD&range=7d|30d|12w|12m` still works. Weekly
  points are 7-day blocks, and the last month ends on the selected date.
  `GET /api/analytics/referrals?date=YYYY-MM-DD&period=...`
  returns `{ destinations: [{ label, listed, patients: [...] }] }`, the referral lists with
  patient details and queue markers (`stickerColour`, `family`, `tbStatus`).
  `GET /api/analytics/partner-ngo?date=YYYY-MM-DD&period=...[&from=YYYY-MM-DD]` (`from`, on
  or before `date`, replaces the period's start) returns `{ types: [{ id, label,
  listed, patients: [...] }], more }`: every type on the `seva_referrals` list, then saved
  types no longer on it, each with its patients (newest visit first, at most 500 in all;
  `more` says the list was cut short). Each patient has `referral`, `referralDate`,
  `diagnosis`, visit and patient details, and the queue markers.
  `GET /api/analytics/optician?date=YYYY-MM-DD&period=...` returns `{ patients: [...], more }`,
  the visits with `visual_acuity.refer_optician` (newest first, at most 500) with patient
  details, the six readings and `notes`.
  `GET /api/analytics/follow-up?date=YYYY-MM-DD&period=...` returns `notDischarged` (with
  each visit's `station`) and `unsignedReferrals` (with `destinations`), at most 200 of each
  (`notDischargedMore` / `unsignedReferralsMore` say a list was cut short).
  The referral, Partner NGO, optician and follow-up lists contain patient names; like the rest of Analytics they
  need the `analytics` permission. A `location_id` sent by an older app is ignored.
- All require a signed-in, active account, check their filters, and are never cached.
- Each total is counted in its own query, so joining several station records never
  double-counts. A failed request shows an error, not zeros. If the filters change
  while a request is loading, the old result is ignored.
- The default date is the host's today. Dismissing the "How to use this page" tip
  is remembered on that browser only.
- Charts are plain SVG with a fixed colour and dash pattern per condition
  (`conditionColor`, `conditionDash` in `constants/consultationConditions.ts`); no chart
  library is used. Condition colours avoid red (kept for TB and danger) and brand blue
  (kept for Patients reached).
- Condition categories come from `015_consultation_conditions.sql`, applied
  automatically at server start-up.

Tests (database tests use temporary tables only):

```powershell
npm test --workspace apps/frontend
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand tests/analyticsPeriods.test.js tests/analytics.database.test.js tests/analyticsReferrals.database.test.js
```
