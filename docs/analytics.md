# Analytics

Open **Analytics** from the user menu (both Admin and User can). It shows clinic
numbers for a location and time period. It contains no patient names, IDs, notes or
signatures.

## Using the page

- **Filters:** choose a location (or **All locations**), a period (**Day**, **Week**,
  **30 days** or **Overall**) and the end date. Every section uses these filters.
- **Section links** at the top jump to Summary, Trends, Conditions, Locations and
  Clinic operations.
- **ⓘ buttons** explain what each number means. Hover over one to preview it, or tap
  it to keep it open.
- **Refresh** reloads the latest saved data. **Back** returns Home.
- **Export** downloads a spreadsheet (CSV) or opens the print window, where you can
  print or save as PDF. Both work without internet.
- Charts can be read by hovering, tapping or using the arrow keys. Each has a **Show as
  table** option.
- If nothing matches, the page offers a longer period or All locations with one click.

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
| Referral destinations | Visits referring to each destination. One referral can choose several. |
| Conditions | Consulted patients for each condition the doctor ticked. A patient can count under several conditions. |
| Condition mix (pie) | Each condition's share of all ticked conditions, not of patients. |
| Patients by location | For All locations: a patient seen at two locations counts at both. |
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

- `GET /api/analytics?location_id=<id>|all&date=YYYY-MM-DD&period=day|week|month|all`
  returns the summary (the default period is `day`).
  `GET /api/analytics/trend?location_id=<id>|all&date=YYYY-MM-DD&range=7d|30d|12w|12m`
  returns the trend points. Weekly points are 7-day blocks, and the last month ends on
  the selected date.
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
npm test --workspace apps/backend -- --runInBand tests/analytics.database.test.js
```
