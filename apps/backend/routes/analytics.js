const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('./auth');
const { permissionsFor } = require('../utils/permissions');
const router = express.Router();
const { getOptions } = require('../utils/formOptions');

const FILTER_ERROR = 'Select a valid date (YYYY-MM-DD).';
// Calendar days preceding the selected date that each rolling period also includes.
const PERIOD_DAYS = { day: 0, week: 6, month: 29 };
// trip: the run of clinic dates ending at the selected date (tripStart).
const PERIODS = ['day', 'week', 'month', 'trip', 'all'];
const TREND_RANGES = ['7d', '30d', '12w', '12m'];
// Clinic dates at most this many days apart belong to one trip (a rest day or two between
// villages); a longer gap starts a new trip.
const TRIP_GAP_DAYS = 3;

// The selected date (YYYY-MM-DD). A location_id sent by an older client is ignored.
function parseFilters(query) {
  const date = query.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return null;
  }
  return { date };
}

const shiftDays = (date, days) => {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);

// First date of the trip that ends on `date`: walks back through the clinic dates (YYYY-MM-DD,
// newest first, none after `date`) while each is at most TRIP_GAP_DAYS before the next. With no
// clinic date close enough, the trip is the selected date alone. Exported for tests.
function tripStart(clinicDates, date) {
  let start = date;
  for (const day of clinicDates) {
    if (daysBetween(day, start) > TRIP_GAP_DAYS) break;
    start = day < start ? day : start;
  }
  return start;
}

// First date of the period ending on `date`, or null for all recorded dates.
async function periodStart(period, date) {
  if (period === 'all') return null;
  if (period !== 'trip') return shiftDays(date, -PERIOD_DAYS[period]);
  const { rows } = await db.query(
    `SELECT DISTINCT TO_CHAR(visit_date, 'YYYY-MM-DD') AS day FROM visits
     WHERE visit_date <= $1::date AND visit_date > $1::date - 366 ORDER BY day DESC`, [date]);
  return tripStart(rows.map(row => row.day), date);
}

// The date and period from the query, or null when either is invalid.
function parsePeriod(query) {
  const filters = parseFilters(query);
  const period = query.period ?? 'day';
  return filters && PERIODS.includes(period) ? { date: filters.date, period } : null;
}

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

// Trend buckets that match the page's period, so the chart covers what the numbers above it cover:
// a day or week shows the last 7 days for context, 30 days by day, all time by month, and a trip
// one point per clinic date (per 7 dates for a trip over 31 days; at least 7 days for a short one).
function periodTrend(period, date, startDate) {
  if (period === 'day' || period === 'week') return { unit: 'day', buckets: trendBuckets('7d', date) };
  if (period === 'month') return { unit: 'day', buckets: trendBuckets('30d', date) };
  if (period === 'all') return { unit: 'month', buckets: trendBuckets('12m', date) };
  const days = Math.max(7, daysBetween(startDate, date) + 1);
  if (days <= 31) return { unit: 'day', buckets: Array.from({ length: days }, (_, i) => { const day = shiftDays(date, i - days + 1); return [day, day]; }) };
  const weeks = Math.ceil(days / 7);
  return { unit: 'week', buckets: Array.from({ length: weeks }, (_, i) => [shiftDays(date, (i - weeks + 1) * 7 - 6), shiftDays(date, (i - weeks + 1) * 7)]) };
}
const RANGE_UNIT = { '7d': 'day', '30d': 'day', '12w': 'week', '12m': 'month' };

// Analytics is for the admin and accounts with the analytics permission. Recheck the account even
// when this router is mounted independently.
async function activeAccount(req, res) {
  const { rows } = await db.query('SELECT role, permissions FROM users WHERE id=$1 AND is_active=TRUE', [req.user.id]);
  const allowed = rows.length > 0 && permissionsFor(rows[0].role, rows[0].permissions).includes('analytics');
  if (!allowed) res.status(403).json({ error: 'This account doesn\'t have the "Analytics" permission. Ask the admin to turn it on in Accounts.' });
  return allowed;
}

// Every condition in the Consult form's current list (with zero counts), then any condition that is
// no longer listed but was ticked on visits in the period, under its saved id.
async function conditionCounts(counted) {
  const listed = await getOptions('consultation_conditions');
  const count = id => counted.find(row => row.id === id)?.count ?? 0;
  return [
    ...listed.map(condition => ({ ...condition, count: count(condition.id) })),
    ...counted.filter(row => !listed.some(condition => condition.id === row.id)).map(row => ({ id: row.id, label: row.id, count: row.count })),
  ];
}

// Read-only aggregates for a clinic-day cohort, never patient names or clinical notes.
router.get('/', authenticateToken, async (req, res) => {
  const filters = parsePeriod(req.query);
  if (!filters) return res.status(400).json({ error: FILTER_ERROR });
  const { date, period } = filters;
  try {
    if (!await activeAccount(req, res)) return;
    const startDate = await periodStart(period, date);
    const { rows } = await db.query(`
      WITH cohort AS (
        SELECT id, patient_id, completed_at, visit_date FROM visits
        WHERE visit_date <= $1::date AND ($2::date IS NULL OR visit_date >= $2::date)
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
        SELECT CASE WHEN date_of_birth IS NULL OR date_of_birth > $1::date THEN 'Unknown'
          WHEN EXTRACT(YEAR FROM age($1::date, date_of_birth)) < 18 THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM age($1::date, date_of_birth)) < 60 THEN '18–59'
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
      -- One row per clinic date, with the screening-day accounts for it (named for the village,
      -- e.g. dec13village), so a trip report can say what each village day saw.
      COALESCE((SELECT json_agg(t ORDER BY t.date) FROM (
        SELECT TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS date,
          COALESCE((SELECT array_agg(u.username ORDER BY u.username) FROM users u WHERE u.screening_date = v.visit_date), '{}') AS accounts,
          COUNT(DISTINCT v.patient_id)::int AS people,
          COUNT(DISTINCT v.patient_id) FILTER (WHERE c.id IS NOT NULL)::int AS "consultedPeople",
          COUNT(r.visit_id)::int AS "referralVisits"
        FROM cohort v LEFT JOIN consulted c ON c.id = v.id LEFT JOIN referral r ON r.visit_id = v.id
        GROUP BY v.visit_date
      ) t), '[]'::json) AS days
    `, [date, startDate]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ date, period, startDate, endDate: date, generatedAt: new Date().toISOString(), ...rows[0],
      conditions: await conditionCounts(rows[0].conditions),
    });
  } catch (error) {
    console.error('Analytics retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load analytics. Please try again.' });
  }
});

// Groups referral rows (one per visit and destination) into one list per destination. A stored
// name that matches a current Referral destinations choice apart from case or spacing is shown
// under that choice, so "OPTICIAN" and "Optician" are one list. Every current choice is listed,
// even with no patients, in the order of the Station data list; other saved names follow, largest
// first. Exported for tests.
function groupReferralLists(rows, listed) {
  const key = label => String(label).trim().replace(/\s+/g, ' ').toLowerCase();
  const groups = new Map(listed.map(option => [key(option.label), { label: option.label, listed: true, patients: [] }]));
  for (const row of rows) {
    const id = key(row.destination);
    if (!groups.has(id)) groups.set(id, { label: row.destination.trim(), listed: false, patients: [] });
    const { destination: _destination, ...patient } = row;
    groups.get(id).patients.push(patient);
  }
  const all = [...groups.values()];
  return [
    ...all.filter(group => group.listed),
    ...all.filter(group => !group.listed).sort((a, b) => b.patients.length - a.patients.length || a.label.localeCompare(b.label)),
  ];
}

// GET /api/analytics/referrals?date=YYYY-MM-DD&period=day|week|month|all
// Patients referred to each destination, for the visits in the period (by visit date, like the
// rest of Analytics). Unlike the summary, this contains patient details, for taking the lists on
// referral days; like all of Analytics it needs the analytics permission (utils/permissions.js).
router.get('/referrals', authenticateToken, async (req, res) => {
  const filters = parsePeriod(req.query);
  if (!filters) return res.status(400).json({ error: FILTER_ERROR });
  const { date, period } = filters;
  try {
    if (!await activeAccount(req, res)) return;
    const startDate = await periodStart(period, date);
    const { rows } = await db.query(`
      WITH destinations AS (
        -- A destination written twice on one referral counts once.
        SELECT DISTINCT ON (r.visit_id, lower(btrim(destination))) r.visit_id, btrim(destination) AS destination
        FROM referral r
        JOIN visits v ON v.id = r.visit_id
        CROSS JOIN LATERAL unnest(string_to_array(r.referral_type, E'\\n')) AS destination
        WHERE btrim(destination) <> ''
          AND v.visit_date <= $1::date AND ($2::date IS NULL OR v.visit_date >= $2::date)
      )
      SELECT d.destination, v.id AS "visitId", p.id AS "patientId", v.queue_no AS "queueNo",
        TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS "visitDate",
        p.english_name AS "englishName", p.khmer_name AS "khmerName", p.sex::text AS sex,
        TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth",
        CASE WHEN p.date_of_birth IS NULL OR p.date_of_birth > v.visit_date THEN NULL
          ELSE EXTRACT(YEAR FROM age(v.visit_date, p.date_of_birth))::int END AS age,
        p.phone_number AS phone, p.address,
        TO_CHAR(r.referral_date, 'YYYY-MM-DD') AS "referralDate", r.illness AS condition, r.reason,
        (r.signature IS NOT NULL) AS signed,
        v.sticker_colour AS "stickerColour", p.family, NULLIF(tb.status, 'observed') AS "tbStatus"
      FROM destinations d
      JOIN referral r ON r.visit_id = d.visit_id
      JOIN visits v ON v.id = d.visit_id
      JOIN patients p ON p.id = v.patient_id
      LEFT JOIN tb_screening tb ON tb.visit_id = v.id
      ORDER BY v.visit_date, v.created_at, v.id
    `, [date, startDate]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ date, period, startDate, endDate: date, generatedAt: new Date().toISOString(),
      destinations: groupReferralLists(rows, await getOptions('referral_destinations')),
    });
  } catch (error) {
    console.error('Referral list retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load referral lists. Please try again.' });
  }
});

// Counts per date bucket for trend charts. Patients are deduplicated within each
// bucket only, so bucket values are not additive across a range.
// With ?period= the buckets follow the page's period (periodTrend); ?range= (older clients) picks a
// fixed range instead.
router.get('/trend', authenticateToken, async (req, res) => {
  const filters = parseFilters(req.query);
  const { period } = req.query;
  const range = period ? null : req.query.range ?? '30d';
  if (!filters || (period ? !PERIODS.includes(period) : !TREND_RANGES.includes(range))) return res.status(400).json({ error: FILTER_ERROR });
  try {
    if (!await activeAccount(req, res)) return;
    const { unit, buckets } = period
      ? periodTrend(period, filters.date, await periodStart(period, filters.date))
      : { unit: RANGE_UNIT[range], buckets: trendBuckets(range, filters.date) };
    const { rows } = await db.query(`
      WITH buckets AS (
        SELECT * FROM unnest($1::date[], $2::date[]) WITH ORDINALITY AS b(start_date, end_date, idx)
      ), cohort AS (
        SELECT b.idx, v.id, v.patient_id FROM buckets b
        JOIN visits v ON v.visit_date BETWEEN b.start_date AND b.end_date
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
    `, [buckets.map(b => b[0]), buckets.map(b => b[1])]);
    const conditions = await getOptions('consultation_conditions');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ range, period: period ?? null, unit, date: filters.date, generatedAt: new Date().toISOString(),
      buckets: rows.map(row => ({ ...row, conditions: Object.fromEntries(conditions.map(({ id }) => [id, row.conditions[id] ?? 0])) })),
    });
  } catch (error) {
    console.error('Analytics trend retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load trends. Please try again.' });
  }
});

// GET /api/analytics/follow-up?date=YYYY-MM-DD&period=...
// Who still needs something before the day can be closed: visits not yet discharged (with the
// station they are at) and referrals saved without a signature. Contains patient names, so like the
// referral lists it needs the analytics permission. At most FOLLOW_UP_LIMIT of each, oldest first.
const FOLLOW_UP_LIMIT = 200;
router.get('/follow-up', authenticateToken, async (req, res) => {
  const filters = parsePeriod(req.query);
  if (!filters) return res.status(400).json({ error: FILTER_ERROR });
  const { date, period } = filters;
  try {
    if (!await activeAccount(req, res)) return;
    const startDate = await periodStart(period, date);
    const patient = `v.id AS "visitId", p.id AS "patientId", v.queue_no AS "queueNo",
      TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS "visitDate", p.english_name AS "englishName", p.khmer_name AS "khmerName",
      v.sticker_colour AS "stickerColour", p.family, NULLIF(tb.status, 'observed') AS "tbStatus"`;
    const visits = 'visits v JOIN patients p ON p.id = v.patient_id LEFT JOIN tb_screening tb ON tb.visit_id = v.id';
    const inPeriod = 'v.visit_date <= $1::date AND ($2::date IS NULL OR v.visit_date >= $2::date)';
    const [open, unsigned] = await Promise.all([
      db.query(`SELECT ${patient},
          (SELECT s.station FROM visit_stations s WHERE s.visit_id = v.id AND s.completed_at IS NULL ORDER BY s.position LIMIT 1) AS station
        FROM ${visits} WHERE ${inPeriod} AND v.completed_at IS NULL
        ORDER BY v.visit_date, v.created_at, v.id LIMIT ${FOLLOW_UP_LIMIT + 1}`, [date, startDate]),
      db.query(`SELECT ${patient},
          ARRAY(SELECT DISTINCT btrim(d) FROM unnest(string_to_array(r.referral_type, E'\\n')) AS d WHERE btrim(d) <> '') AS destinations
        FROM ${visits} JOIN referral r ON r.visit_id = v.id WHERE ${inPeriod} AND r.signature IS NULL
        ORDER BY v.visit_date, v.created_at, v.id LIMIT ${FOLLOW_UP_LIMIT + 1}`, [date, startDate]),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ date, period, startDate, endDate: date, generatedAt: new Date().toISOString(),
      notDischarged: open.rows.slice(0, FOLLOW_UP_LIMIT), notDischargedMore: open.rows.length > FOLLOW_UP_LIMIT,
      unsignedReferrals: unsigned.rows.slice(0, FOLLOW_UP_LIMIT), unsignedReferralsMore: unsigned.rows.length > FOLLOW_UP_LIMIT,
    });
  } catch (error) {
    console.error('Analytics follow-up retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load the follow-up lists. Please try again.' });
  }
});

// GET /api/analytics/partner-ngo?date=YYYY-MM-DD&period=...
// Patients the Partner NGO station marked for referral in the period, grouped by referral type in
// the order of the editable "seva_referrals" list (types since removed from it come after, by id).
// Each row has the referral date, diagnosis and the patient's details, so it needs the analytics
// permission like the other lists. At most PARTNER_NGO_LIMIT patients, newest visit first.
const PARTNER_NGO_LIMIT = 500;
router.get('/partner-ngo', authenticateToken, async (req, res) => {
  const filters = parsePeriod(req.query);
  if (!filters) return res.status(400).json({ error: FILTER_ERROR });
  const { date, period } = filters;
  try {
    if (!await activeAccount(req, res)) return;
    const [startDate, options] = await Promise.all([periodStart(period, date), getOptions('seva_referrals')]);
    const { rows } = await db.query(
      `SELECT v.id AS "visitId", p.id AS "patientId", v.queue_no AS "queueNo",
          TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS "visitDate", s.referral,
          TO_CHAR(s.date_of_referral, 'YYYY-MM-DD') AS "referralDate", s.diagnosis,
          p.english_name AS "englishName", p.khmer_name AS "khmerName", p.sex,
          TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth", p.phone_number AS phone,
          v.sticker_colour AS "stickerColour", p.family, NULLIF(tb.status, 'observed') AS "tbStatus"
        FROM seva s
        JOIN visits v ON v.id = s.visit_id
        JOIN patients p ON p.id = v.patient_id
        LEFT JOIN tb_screening tb ON tb.visit_id = v.id
        WHERE s.referral IS NOT NULL
          AND v.visit_date <= $1::date AND ($2::date IS NULL OR v.visit_date >= $2::date)
        ORDER BY v.visit_date DESC, v.created_at DESC, v.id DESC
        LIMIT ${PARTNER_NGO_LIMIT + 1}`, [date, startDate]);
    const patients = rows.slice(0, PARTNER_NGO_LIMIT);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ date, period, startDate, endDate: date, generatedAt: new Date().toISOString(),
      types: groupPartnerNgoReferrals(patients, options), more: rows.length > PARTNER_NGO_LIMIT });
  } catch (error) {
    console.error('Analytics Partner NGO referrals retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load the Partner NGO referrals. Please try again.' });
  }
});

// GET /api/analytics/optician?date=YYYY-MM-DD&period=...
// Patients Triage ticked "Refer to optician" for in the period, newest visit first, with their
// details and visual acuity readings, to take to the optician. Needs the analytics permission.
const OPTICIAN_LIMIT = 500;
router.get('/optician', authenticateToken, async (req, res) => {
  const filters = parsePeriod(req.query);
  if (!filters) return res.status(400).json({ error: FILTER_ERROR });
  const { date, period } = filters;
  try {
    if (!await activeAccount(req, res)) return;
    const startDate = await periodStart(period, date);
    const { rows } = await db.query(
      `SELECT v.id AS "visitId", p.id AS "patientId", v.queue_no AS "queueNo",
          TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS "visitDate",
          p.english_name AS "englishName", p.khmer_name AS "khmerName", p.sex,
          TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth", p.phone_number AS phone, p.address,
          va.left_without_pinhole AS "leftWithoutPinhole", va.right_without_pinhole AS "rightWithoutPinhole",
          va.left_with_pinhole AS "leftWithPinhole", va.right_with_pinhole AS "rightWithPinhole",
          va.left_with_glasses AS "leftWithGlasses", va.right_with_glasses AS "rightWithGlasses",
          NULLIF(va.notes, '') AS notes,
          v.sticker_colour AS "stickerColour", p.family, NULLIF(tb.status, 'observed') AS "tbStatus"
        FROM visual_acuity va
        JOIN visits v ON v.id = va.visit_id
        JOIN patients p ON p.id = v.patient_id
        LEFT JOIN tb_screening tb ON tb.visit_id = v.id
        WHERE va.refer_optician
          AND v.visit_date <= $1::date AND ($2::date IS NULL OR v.visit_date >= $2::date)
        ORDER BY v.visit_date DESC, v.created_at DESC, v.id DESC
        LIMIT ${OPTICIAN_LIMIT + 1}`, [date, startDate]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ date, period, startDate, endDate: date, generatedAt: new Date().toISOString(),
      patients: rows.slice(0, OPTICIAN_LIMIT), more: rows.length > OPTICIAN_LIMIT });
  } catch (error) {
    console.error('Analytics optician referrals retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load the optician referrals. Please try again.' });
  }
});

// [{ id, label, listed, patients }]: every current type (even with no patients), then saved ids no
// longer on the list. Exported for tests.
function groupPartnerNgoReferrals(rows, options) {
  const types = options.map(option => ({ id: option.id, label: option.label, listed: true, patients: [] }));
  for (const row of rows) {
    let type = types.find(t => t.id === row.referral);
    if (!type) {
      type = { id: row.referral, label: row.referral, listed: false, patients: [] };
      types.push(type);
    }
    type.patients.push(row);
  }
  return types;
}

module.exports = router;
module.exports.groupReferralLists = groupReferralLists;
module.exports.tripStart = tripStart;
module.exports.periodTrend = periodTrend;
module.exports.groupPartnerNgoReferrals = groupPartnerNgoReferrals;
