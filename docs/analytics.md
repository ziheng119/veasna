# Analytics draft

Both Admin and User can open **Analytics** from the user menu. `/analytics` is
outside the station layout: it has a Return link to Home, filters and dashboard,
without the main navigation or footer.

The read-only `GET /api/analytics?location_id=<id>&date=YYYY-MM-DD` requires a valid
authenticated, active account. Both roles can read the aggregates; patient names,
IDs, clinical notes and signatures are excluded. Responses use `Cache-Control: no-store`.

## Metrics and denominators

The selected location and **visit date** define the cohort. Today defaults to the
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
- **Documentation checks:** non-empty consultation notes, unsigned referrals, and
  missing/future birth dates. These are review prompts, not care quality scores.

The API validates date/location filters and uses parameterized queries. Separate
aggregate subqueries avoid multiplication from joining multiple station records.
Empty cohorts show zero counts. Failed requests show an error, not misleading zero
counts; outdated requests are aborted and ignored after filters change.

## Proposed healthcare analytics

The draft explicitly separates these suggestions from measured data:

1. **Chronic disease:** unique consulted patients with clinician-confirmed diabetes
   or hypertension, separated into known/new/suspected diagnoses. Consultation has
   no structured diagnosis field today. Do not infer confirmed disease from text
   searches: negation, family history, language and abbreviations make this unreliable.
2. **Continuity:** referral attendance, time to follow-up and documented outcomes.
   A saved referral does not establish whether a patient received onward care.
3. **Access:** communities reached, returning/new patients, travel barriers and
   clinic-day comparisons. Validate village/location coding before presenting trends.
4. **Supply planning:** dispensed medicine quantities, unmet prescriptions and
   stock-out history, once the relevant records and date associations are validated.

No diagnosis capture/schema changes, clinical thresholds or inferred diagnoses
are introduced by this draft. Decisions about new clinical fields and workflow
should precede the next analytics iteration.

## Setup and tests

Restart the backend to register the route. No migration, external analytics
service, new chart dependency or internet access is required for this feature.
Existing project schema migrations should already be applied.

```powershell
npm.cmd test --workspace apps/frontend -- --runInBand
$env:RUN_DB_TESTS='1'
npm.cmd test --workspace apps/backend -- --runInBand tests/analytics.database.test.js
```

Database tests use temporary tables only and verify authorization, demotion,
location/date isolation, unique-person counts, waiting stations, multi-destination
referrals, invalid filters and empty results. UI tests cover available to both admin and user entry,
direct-route access, filter changes, failures and stale-request cancellation.
