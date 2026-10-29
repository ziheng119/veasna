const express = require('express');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');
const router = express.Router();
const { CONDITIONS } = require('../utils/consultationConditions');

const FILTER_ERROR = 'Select a valid location and date (YYYY-MM-DD).';
// Calendar days preceding the selected date that each rolling period also includes.
const PERIOD_DAYS = { day: 0, week: 6, month: 29 };
const TREND_RANGES = ['7d', '30d', '12w', '12m'];

// location_id=all aggregates every clinic location; the null id disables the SQL filter.
function parseFilters(query) {
  const all = query.location_id === 'all';
  const locationId = all ? null : Number(query.location_id);
  const date = query.date;
  if ((!all && (!Number.isSafeInteger(locationId) || locationId <= 0)) ||
      typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return null;
  }
  return { locationId, date, responseLocationId: all ? 'all' : locationId };
}

const shiftDays = (date, days) => {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

// Inclusive [start, end] date buckets ending on the selected date. Weeks are seven
// calendar dates (not locale week numbers); the last month is truncated at the date.
function trendBuckets(range, date) {
  if (range === '7d' || range === '30d') {
    const days = range === '7d' ? 7 : 30;
    return Array.from({ length: days }, (_, i) => { const day = shiftDays(date, i - days + 1); return [day, day]; });
  }
  if (range === '12w') {
    return Array.from({ length: 12 }, (_, i) => [shiftDays(date, (i - 11) * 7 - 6), shiftDays(date, (i - 11) * 7)]);
  }
  const [year, month] = date.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const first = new Date(Date.UTC(year, month - 12 + i, 1));
    const last = new Date(Date.UTC(year, month - 11 + i, 0));
    const end = i === 11 ? date : last.toISOString().slice(0, 10);
    return [first.toISOString().slice(0, 10), end];
  });
}

// Recheck account activity even when this router is mounted independently.
async function activeAccount(req, res) {
  const account = await db.query("SELECT id FROM users WHERE id=$1 AND role IN ('admin', 'user') AND is_active=TRUE", [req.user.id]);
  if (!account.rows.length) res.status(403).json({ error: 'Active account required.' });
  return account.rows.length > 0;
}

// Read-only aggregates for a clinic-day cohort, never patient names or clinical notes.
router.get('/', authenticateToken, requireRole(['admin', 'user']), async (req, res) => {
  const filters = parseFilters(req.query);
  const period = req.query.period ?? "day";
  if (!filters || !['day', 'week', 'month', 'all'].includes(period)) return res.status(400).json({ error: FILTER_ERROR });
  const { locationId, date } = filters;
  const startDate = period === 'all' ? null : shiftDays(date, -PERIOD_DAYS[period]);
  try {
    if (!await activeAccount(req, res)) return;
    const { rows } = await db.query(`
      WITH cohort AS (
        SELECT id, patient_id, location_id, completed_at FROM visits
        WHERE ($1::int IS NULL OR location_id=$1) AND visit_date <= $2::date AND ($3::date IS NULL OR visit_date >= $3::date)
      ), consulted AS (
        SELECT v.id, v.patient_id FROM cohort v WHERE EXISTS (
          SELECT 1 FROM visit_stations s WHERE s.visit_id=v.id AND s.station='consultation' AND s.completed_at IS NOT NULL
        )
      ), condition_counts AS (
        SELECT category AS id, COUNT(DISTINCT v.patient_id)::int AS count
        FROM consulted v JOIN consultation c ON c.visit_id=v.id
        CROSS JOIN LATERAL unnest(c.condition_categories) AS category GROUP BY category
      ), people AS (
        SELECT DISTINCT p.id, p.date_of_birth FROM patients p JOIN cohort v ON v.patient_id=p.id
      ), station_rows AS (
        SELECT s.*, v.completed_at AS visit_completed_at FROM visit_stations s JOIN cohort v ON v.id=s.visit_id
      ), current_station AS (
        SELECT DISTINCT ON (visit_id) visit_id, station FROM station_rows
        WHERE completed_at IS NULL AND visit_completed_at IS NULL ORDER BY visit_id, position
      ), age_counts AS (
        SELECT CASE WHEN date_of_birth IS NULL OR date_of_birth > $2::date THEN 'Unknown'
          WHEN EXTRACT(YEAR FROM age($2::date, date_of_birth)) < 18 THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM age($2::date, date_of_birth)) < 60 THEN '18–59'
          ELSE '60+' END AS label, COUNT(*)::int AS count FROM people GROUP BY 1
      ), destinations AS (
        SELECT DISTINCT r.visit_id, btrim(destination) AS label FROM referral r
        JOIN cohort v ON v.id=r.visit_id
        CROSS JOIN LATERAL unnest(string_to_array(r.referral_type, E'\\n')) AS destination
        WHERE btrim(destination) <> ''
      )
      SELECT json_build_object(
        'consultedVisits', (SELECT COUNT(*)::int FROM consulted),
        'conditionReviewedVisits', (SELECT COUNT(*)::int FROM consulted v JOIN consultation c ON c.visit_id=v.id WHERE c.condition_categories IS NOT NULL),
        'people', (SELECT COUNT(*)::int FROM people),
        'visits', (SELECT COUNT(*)::int FROM cohort),
        'consultedPeople', (SELECT COUNT(DISTINCT v.patient_id)::int FROM cohort v
          WHERE EXISTS (SELECT 1 FROM station_rows s WHERE s.visit_id=v.id AND s.station='consultation' AND s.completed_at IS NOT NULL)),
        'dischargedVisits', (SELECT COUNT(*)::int FROM cohort WHERE completed_at IS NOT NULL),
        'referralVisits', (SELECT COUNT(*)::int FROM referral r JOIN cohort v ON v.id=r.visit_id),
        'notesSaved', (SELECT COUNT(*)::int FROM consultation c JOIN cohort v ON v.id=c.visit_id WHERE btrim(c.notes) <> ''),
        'unsignedReferrals', (SELECT COUNT(*)::int FROM referral r JOIN cohort v ON v.id=r.visit_id WHERE r.signature IS NULL)
      ) AS summary,
      COALESCE((SELECT json_agg(t) FROM condition_counts t), '[]'::json) AS conditions,
      COALESCE((SELECT json_agg(t ORDER BY t.station) FROM (
        SELECT station, COUNT(*)::int AS assigned,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed,
          (SELECT COUNT(*)::int FROM current_station c WHERE c.station=s.station) AS waiting
        FROM station_rows s GROUP BY station
      ) t), '[]'::json) AS stations,
      COALESCE((SELECT json_agg(t) FROM age_counts t), '[]'::json) AS ages,
      COALESCE((SELECT json_agg(t ORDER BY t.count DESC, t.label) FROM (
        SELECT label, COUNT(*)::int AS count FROM destinations GROUP BY label
      ) t), '[]'::json) AS destinations,
      COALESCE((SELECT json_agg(t ORDER BY t."locationId") FROM (
        SELECT location_id AS "locationId", COUNT(DISTINCT patient_id)::int AS people, COUNT(*)::int AS visits
        FROM cohort WHERE location_id IS NOT NULL GROUP BY location_id
      ) t), '[]'::json) AS locations
    `, [locationId, date, startDate]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ date, period, startDate, endDate: date, locationId: filters.responseLocationId, generatedAt: new Date().toISOString(), ...rows[0],
      conditions: CONDITIONS.map(condition => ({ ...condition, count: rows[0].conditions.find(row => row.id === condition.id)?.count ?? 0 })),
    });
  } catch (error) {
    console.error('Analytics retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load analytics. Please try again.' });
  }
});

// Counts per date bucket for trend charts. Patients are deduplicated within each
// bucket only, so bucket values are not additive across a range.
router.get('/trend', authenticateToken, requireRole(['admin', 'user']), async (req, res) => {
  const filters = parseFilters(req.query);
  const range = req.query.range ?? '30d';
  if (!filters || !TREND_RANGES.includes(range)) return res.status(400).json({ error: FILTER_ERROR });
  const buckets = trendBuckets(range, filters.date);
  try {
    if (!await activeAccount(req, res)) return;
    const { rows } = await db.query(`
      WITH buckets AS (
        SELECT * FROM unnest($2::date[], $3::date[]) WITH ORDINALITY AS b(start_date, end_date, idx)
      ), cohort AS (
        SELECT b.idx, v.id, v.patient_id FROM buckets b
        JOIN visits v ON v.visit_date BETWEEN b.start_date AND b.end_date
        WHERE ($1::int IS NULL OR v.location_id=$1)
      ), consulted AS (
        SELECT v.idx, v.id, v.patient_id FROM cohort v WHERE EXISTS (
          SELECT 1 FROM visit_stations s WHERE s.visit_id=v.id AND s.station='consultation' AND s.completed_at IS NOT NULL
        )
      ), condition_counts AS (
        SELECT v.idx, category, COUNT(DISTINCT v.patient_id)::int AS count
        FROM consulted v JOIN consultation c ON c.visit_id=v.id
        CROSS JOIN LATERAL unnest(c.condition_categories) AS category GROUP BY v.idx, category
      )
      SELECT to_char(b.start_date, 'YYYY-MM-DD') AS "startDate", to_char(b.end_date, 'YYYY-MM-DD') AS "endDate",
        (SELECT COUNT(*)::int FROM cohort v WHERE v.idx=b.idx) AS visits,
        (SELECT COUNT(DISTINCT v.patient_id)::int FROM cohort v WHERE v.idx=b.idx) AS people,
        (SELECT COUNT(DISTINCT v.patient_id)::int FROM consulted v WHERE v.idx=b.idx) AS "consultedPeople",
        COALESCE((SELECT json_object_agg(c.category, c.count) FROM condition_counts c WHERE c.idx=b.idx), '{}'::json) AS conditions
      FROM buckets b ORDER BY b.idx
    `, [filters.locationId, buckets.map(b => b[0]), buckets.map(b => b[1])]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ range, date: filters.date, locationId: filters.responseLocationId, generatedAt: new Date().toISOString(),
      buckets: rows.map(row => ({ ...row, conditions: Object.fromEntries(CONDITIONS.map(({ id }) => [id, row.conditions[id] ?? 0])) })),
    });
  } catch (error) {
    console.error('Analytics trend retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load trends. Please try again.' });
  }
});

module.exports = router;
