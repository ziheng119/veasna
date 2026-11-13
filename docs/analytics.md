# Analytics

Open **Analytics** from the account menu (your username, top right). The **admin** can,
and so can screening-day accounts with the **Analytics** permission. It shows clinic
numbers for a time period. Apart from the referral lists (below), it
contains no patient names, IDs, notes or signatures.

## Using the page

- **Printing referrals:** hover over (or tap) the **Visits with referrals** card and
  press **Print referrals** to print saved referral letters for today, a date, a period
  or all dates. This needs the **Print and download** permission too. The letters contain
  patient details; the analytics numbers do not. See [printing saved referrals](consultation-referrals.md#printing-saved-referrals).
- **Filters:** choose a period (**Day**, **Week**, **30 days** or **Overall**) and the
  end date. Every section uses these filters. There is one clinic, so every visit counts.
- **Section links** at the top jump to Summary, Trends, Conditions, Referrals and
  Clinic operations.
- **Referral lists:** under **Patients by referral destination**, each destination shows
  how many patients were referred there, as a bar. Pick one to list its patients,
  numbered in the order they were seen: name (English and Khmer), age and sex, queue
  number, visit date, phone, address and the reason for referral. Unsigned drafts are
  marked. Pressing a name opens the patient's record. **Print list** prints the chosen
  destination; **Print all lists** prints every destination with patients, one per page,
  to take on referral days. Every current destination is listed, even with no patients;
  names saved on older referrals that are no longer on the list appear after them.
- **ⓘ buttons** explain what each number means. Hover over one to preview it, or tap
  it to keep it open.
- **Refresh** reloads the latest saved data. **Back** returns to Registration.
- **Export** downloads a spreadsheet (CSV) or opens the print window, where you can
  print or save as PDF. Both work without internet.
- Charts can be read by hovering, tapping or using the arrow keys. Each has a **Show as
  table** option.
- If nothing matches, the page offers a longer period, or all time, with one click.

## What the numbers mean

The period counts visits by **visit date**. "Week" is the end date plus the 6 days
before it; "30 days" is the end date plus the 29 before it; "Overall" is every date up to
the end date. Numbers show each visit's **current** saved state, not a snapshot from
the end of that day.

| Number | Meaning |
| --- | --- |
| Patients reached | Different patients seen. A patient who came twice counts once. |
| Patients consulted | Patients whose Consultation station is marked finished. Only saving notes doesn't count. |
| Visits with referrals | Visits with a saved referral, including unsigned drafts. |
| Visits discharged | Visits marked as discharged. This doesn't mean every station was done. |
| Station workload | Stations assigned and finished. "Waiting" counts each patient once, at their next station. |
| Age groups | Patients by age on the end date. Missing or future birth dates show as Unknown. |
| Patients by referral destination | Referred visits for each destination. One referral can choose several, so a patient can be in more than one list. A name differing only in capitals or spacing (e.g. `OPTICIAN`) counts under the current choice. |
| Conditions | Consulted patients for each condition the doctor ticked. A patient can count under several conditions. |
| Condition mix (pie) | Each condition's share of all ticked conditions, not of patients. |
| Documentation checks | Consultation notes written, referrals not yet signed, and missing or future birth dates. These are reminders to review, not quality scores. |

**Trends** show patients reached and consulted, or conditions, over the last 7 days,
30 days, 12 weeks or 12 months. Each point counts patients within that day, week or
month only, so don't add the points together.

The CSV contains the filters, summary, conditions, age groups, station workload,
referral destinations, documentation checks and the selected trend. It opens in Excel
with Khmer text intact.

## Ideas for later

These need new or checked data before they can be shown:

1. **New vs known conditions:** whether a condition was found at this visit.
2. **Follow-up:** whether referred patients attended and what happened.
3. **Reach:** which communities are reached, and new vs returning patients.
4. **Supplies:** medicine dispensed, prescriptions that couldn't be filled and stock-outs.

## Technical details

- `GET /api/analytics?date=YYYY-MM-DD&period=day|week|month|all`
  returns the summary (the default period is `day`).
  `GET /api/analytics/trend?date=YYYY-MM-DD&range=7d|30d|12w|12m`
  returns the trend points. Weekly points are 7-day blocks, and the last month ends on
  the selected date.
  `GET /api/analytics/referrals?date=YYYY-MM-DD&period=day|week|month|all`
  returns `{ destinations: [{ label, listed, patients: [...] }] }`, the referral lists with
  patient details (the `analytics` permission, like the rest of Analytics). A `location_id`
  sent by an older app is ignored.
- Both require a signed-in, active account, check their filters, and are never cached.
- Each total is counted in its own query, so joining several station records never
  double-counts. A failed request shows an error, not zeros. If the filters change
  while a request is loading, the old result is ignored.
- The default date is the browser's today. Dismissing the "How to use this page" tip
  is remembered on that browser only.
- Charts are plain SVG with fixed colours per condition (`CONDITION_COLORS`); no chart
  library is used.
- Condition categories come from `015_consultation_conditions.sql`, applied
  automatically at server start-up.

Tests (database tests use temporary tables only):

```powershell
npm test --workspace apps/frontend
$env:RUN_DB_TESTS='1'
npm test --workspace apps/backend -- --runInBand tests/analytics.database.test.js tests/analyticsReferrals.database.test.js
```
