# Analytics

Both Admin and User can open **Analytics** from the user menu. `/analytics` is
outside the station layout: it has a Return link to Home, filters and dashboard,
without the main navigation or footer.

The read-only `GET /api/analytics?location_id=<id>|all&date=YYYY-MM-DD&period=day|week|month|all` requires a valid
authenticated, active account. Both roles can read the aggregates; patient names,
IDs, clinical notes and signatures are excluded. Responses use `Cache-Control: no-store`.

## Metrics and denominators

The selected location and **visit-date period** define the cohort. `location_id=all` (shown as **All locations (overall)**) includes every location. Day uses the selected date; Past week includes that date and the preceding six calendar dates; Past 30 days includes that date and the preceding 29; Overall includes every recorded date up to that date. The default API period is day for compatibility. Today defaults to the
browser's local calendar date. Data loads on filter changes or Refresh. These are
current saved statuses of that cohort, not historic end-of-day snapshots or counts
of events that happened on the date. Completed/discharged visits remain included.

- **Patients reached:** distinct patient IDs; repeat visits count once.
- **Patients consulted:** distinct patients with at least one currently completed
  consultation station. Saving notes is not counted as completion. Reopening a
  station resets its current completion status; no cumulative throughput is inferred.
- **Visits with referrals:** saved referral records, including unsigned drafts.
- **Visits discharged:** visits marked with `completed_at`; not necessarily all
  assigned stations completed.
- **Station workload:** assigned/completed visit-station records; waiting is the
  first pending station of each non-discharged visit, not future stations.
- **Age groups:** unique patients, age calculated on the selected date. Missing or
  future dates of birth are reported as Unknown.
- **Referral destinations:** visits selecting each destination, deduplicated within
  a visit. One referral may select multiple destinations.
- **Conditions:** unique patients with a completed consultation whose doctor ticked
  each category. A patient can count in several categories, once per category.
- **Condition mix (pie chart):** each category's share of all condition selections in
  the period. Because one patient can have several conditions, shares are of
  selections, not of patients.
- **Patients reached by location:** shown for All locations. Unique patients per
  location; a patient seen at two locations counts at both.
- **Documentation checks:** non-empty consultation notes, unsigned referrals, and
  missing/future birth dates. These are review prompts, not care quality scores.

The API validates date/location filters and uses parameterized queries. Separate
aggregate subqueries avoid multiplication from joining multiple station records.
Empty cohorts show zero counts. Failed requests show an error, not misleading zero
counts; outdated requests are aborted and ignored after filters change.

Period counts deduplicate patients across the full range. Future visits and other locations are excluded; age groups use the selected end date.

## Trends over time

`GET /api/analytics/trend?location_id=<id>|all&date=YYYY-MM-DD&range=7d|30d|12w|12m`
returns date buckets ending on the selected date: daily for 7d/30d, seven-date
weeks for 12w, and calendar months for 12m (the last month is cut at the date).
Each bucket has `visits`, `people`, `consultedPeople` and a per-condition count of
consulted patients. Patients are deduplicated within each bucket only, so bucket
values must not be summed across a range.

The dashboard plots these as a line chart: patients reached vs consulted, all
conditions compared, or one selected condition. Every chart has a hover tooltip and
a "Show as table" view. Charts are plain SVG, so no chart library or internet is
needed. Each condition keeps a fixed colour (`CONDITION_COLORS`) across charts.

## Future analytics

Possible next metrics, which need new or validated data before they can be shown:

1. **Known vs new diagnoses:** distinguish existing conditions from those found at
   this visit. Do not infer diagnoses from note text.
2. **Continuity:** referral attendance, time to follow-up and documented outcomes.
   A saved referral does not establish whether a patient received onward care.
3. **Access:** communities reached, returning/new patients and travel barriers.
   Validate village/location coding first.
4. **Supply planning:** dispensed medicine quantities, unmet prescriptions and
   stock-out history linked to clinic dates.

## Setup and tests

Restart the backend to register the routes. Condition categories need migration
`015_consultation_conditions.sql` (also applied by `ensureSchema` on start-up). No
external analytics service, chart dependency or internet access is required.

```powershell
npm.cmd test --workspace apps/frontend -- --runInBand
$env:RUN_DB_TESTS='1'
npm.cmd test --workspace apps/backend -- --runInBand tests/analytics.database.test.js
```

Database tests use temporary tables only and verify authorization, demotion,
location/date isolation, unique-person counts, waiting stations, multi-destination
referrals, invalid filters, empty results, all-location aggregation, the 30-day
period and trend buckets. UI tests cover available to both admin and user entry,
direct-route access, filter changes, failures, stale-request cancellation, the All
locations option, trend range/metric switching and the condition pie chart.
