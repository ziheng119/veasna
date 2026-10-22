const express = require('express');
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');
const router = express.Router();

// Read-only aggregates for a clinic-day cohort, never patient names or clinical notes.
router.get('/', authenticateToken, requireRole(['admin', 'user']), async (req, res) => {
  const locationId = Number(req.query.location_id);
  const date = req.query.date;
  if (!Number.isSafeInteger(locationId) || locationId <= 0 ||
      typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'Select a valid location and date (YYYY-MM-DD).' });
  }
  try {
    // Recheck account activity even when this router is mounted independently.
    const admin = await db.query("SELECT id FROM users WHERE id=$1 AND role IN ('admin', 'user') AND is_active=TRUE", [req.user.id]);
    if (!admin.rows.length) return res.status(403).json({ error: 'Active account required.' });
    const { rows } = await db.query(`
      WITH cohort AS (
        SELECT id, patient_id, completed_at FROM visits WHERE location_id=$1 AND visit_date=$2::date
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
        'people', (SELECT COUNT(*)::int FROM people),
        'visits', (SELECT COUNT(*)::int FROM cohort),
        'consultedPeople', (SELECT COUNT(DISTINCT v.patient_id)::int FROM cohort v
          WHERE EXISTS (SELECT 1 FROM station_rows s WHERE s.visit_id=v.id AND s.station='consultation' AND s.completed_at IS NOT NULL)),
        'dischargedVisits', (SELECT COUNT(*)::int FROM cohort WHERE completed_at IS NOT NULL),
        'referralVisits', (SELECT COUNT(*)::int FROM referral r JOIN cohort v ON v.id=r.visit_id),
        'notesSaved', (SELECT COUNT(*)::int FROM consultation c JOIN cohort v ON v.id=c.visit_id WHERE btrim(c.notes) <> ''),
        'unsignedReferrals', (SELECT COUNT(*)::int FROM referral r JOIN cohort v ON v.id=r.visit_id WHERE r.signature IS NULL)
      ) AS summary,
      COALESCE((SELECT json_agg(t ORDER BY t.station) FROM (
        SELECT station, COUNT(*)::int AS assigned,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed,
          (SELECT COUNT(*)::int FROM current_station c WHERE c.station=s.station) AS waiting
        FROM station_rows s GROUP BY station
      ) t), '[]'::json) AS stations,
      COALESCE((SELECT json_agg(t) FROM age_counts t), '[]'::json) AS ages,
      COALESCE((SELECT json_agg(t ORDER BY t.count DESC, t.label) FROM (
        SELECT label, COUNT(*)::int AS count FROM destinations GROUP BY label
      ) t), '[]'::json) AS destinations
    `, [locationId, date]);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ date, locationId, generatedAt: new Date().toISOString(), ...rows[0] });
  } catch (error) {
    console.error('Analytics retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load analytics. Please try again.' });
  }
});

module.exports = router;
