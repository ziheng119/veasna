// routes/queue.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { currentVisitDate, getNextQueueNo } = require('../utils/queueNumber');
const { STATIONS } = require('../utils/stations');
const { planStationRoute } = require('../utils/stationRoute');
const { TB_STATION, TB_HOLD_MESSAGE, flagTb } = require('../utils/tb');

// GET /api/queue?location_id=...&date=...[&station=...]
// Without station: every visit still in the clinic. With station: only the visits currently
// waiting at that station, in the order they arrived there.
router.get('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const { location_id, date } = req.query;
    const station = req.query.station || null;

    if (!location_id || !date) {
        return res.status(400).json({ error: 'location_id and date are required' });
    }

    if (isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'Invalid date format' });
    }

    if (station && !STATIONS.includes(station)) {
        return res.status(400).json({ error: `station must be one of: ${STATIONS.join(', ')}` });
    }

    try {
        const queryText = `
            SELECT
                v.id AS visit_id,
                p.id AS patient_id,
                v.queue_no,
                p.english_name,
                p.khmer_name,
                p.sex,
                EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age,
                TO_CHAR(v.created_at, 'HH:MI AM') AS timestamp,
                -- Display the same station-arrival value used by the queue ordering.
                TO_CHAR(COALESCE(cur.entered_at, v.created_at), 'HH:MI AM') AS station_arrival_time,
                cur.station AS current_station,
                tb.status AS tb_status,
                (
                    SELECT COALESCE(json_agg(json_build_object(
                        'station', s.station,
                        'completed', s.completed_at IS NOT NULL
                    ) ORDER BY s.position, s.id), '[]'::json)
                    FROM visit_stations s
                    WHERE s.visit_id = v.id
                ) AS stations
            FROM visits v
            JOIN patients p ON v.patient_id = p.id
            LEFT JOIN tb_screening tb ON tb.visit_id = v.id
            LEFT JOIN LATERAL (
                SELECT s.station, s.entered_at
                FROM visit_stations s
                WHERE s.visit_id = v.id AND s.completed_at IS NULL
                ORDER BY s.position
                LIMIT 1
            ) cur ON TRUE
            WHERE v.location_id = $1
              AND v.visit_date::date = $2::date
              AND v.completed_at IS NULL
              AND ($3::text IS NULL OR cur.station = $3)
            ORDER BY CASE WHEN $3::text IS NULL THEN v.created_at ELSE COALESCE(cur.entered_at, v.created_at) END ASC,
                     v.id ASC;
        `;
        const result = await db.query(queryText, [location_id, date, station]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching queue:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/queue/next?location_id=... - Preview the next queue number for today
router.get('/next', authenticateToken, requireRole(['any']), async (req, res) => {
    const locationId = Number(req.query.location_id);

    if (!Number.isInteger(locationId) || locationId < 1) {
        return res.status(400).json({ error: 'location_id must be a positive integer' });
    }

    try {
        const queueNo = await getNextQueueNo(db, locationId, currentVisitDate());
        res.status(200).json({ queue_no: queueNo });
    } catch (err) {
        console.error('Error fetching next queue number:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/queue/:visitId/stations/:station/complete - Finish a station and move the visit
// to its next indicated station. Finishing the last station completes the visit.
router.post('/:visitId/stations/:station/complete', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = Number(req.params.visitId);
    const { station } = req.params;
    const last_updated_by = req.user.id;

    if (!Number.isInteger(visitId) || visitId < 1) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }
    if (!STATIONS.includes(station)) {
        return res.status(400).json({ error: `station must be one of: ${STATIONS.join(', ')}` });
    }
    // Leaving the TB tent needs the TB doctor's decision, recorded through /api/tb/:visitId/review
    if (station === TB_STATION) {
        return res.status(409).json({ error: "Record the TB doctor's decision on the TB Tent page to move this patient on.", code: 'TB_HOLD' });
    }

    let client;
    try {
        client = await db.pool.connect();
    } catch (err) {
        console.error('Failed to acquire database connection:', err);
        return res.status(500).json({ error: 'Database connection unavailable' });
    }
    try {
        await client.query('BEGIN');

        // Lock the visit so two devices cannot advance it at the same time
        const visit = await client.query('SELECT id, completed_at FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
        if (visit.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found' });
        }

        const pending = await client.query(
            'SELECT id, station FROM visit_stations WHERE visit_id = $1 AND completed_at IS NULL ORDER BY position',
            [visitId]
        );
        if (visit.rows[0].completed_at || pending.rows.length === 0 || pending.rows[0].station !== station) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Patient is no longer waiting at this station. Refresh the queue.' });
        }

        await client.query(
            'UPDATE visit_stations SET completed_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2',
            [last_updated_by, pending.rows[0].id]
        );

        const next = pending.rows[1] || null;
        if (next) {
            await client.query(
                'UPDATE visit_stations SET entered_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2',
                [last_updated_by, next.id]
            );
        } else {
            await client.query(
                'UPDATE visits SET completed_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2',
                [last_updated_by, visitId]
            );
        }

        await client.query('COMMIT');
        res.status(200).json({ visit_id: visitId, completed_station: station, next_station: next ? next.station : null });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Error completing station:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// PUT /api/queue/:visitId/stations
// ordered=true treats stations as the explicit remaining route (including repeat stations).
// The UI supplies its original snapshot to reject stale edits from concurrent users.
router.put('/:visitId/stations', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = Number(req.params.visitId);
    const userId = req.user.id;
    if (!Number.isInteger(visitId) || visitId < 1) return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    let client;
    try {
        client = await db.pool.connect();
    } catch (err) {
        console.error('Failed to acquire database connection:', err);
        return res.status(500).json({ error: 'Database connection unavailable' });
    }
    try {
        await client.query('BEGIN');
        // This is the same row lock used by completion/TB review, so routing cannot
        // race with another device moving or discharging the patient.
        const visit = await client.query('SELECT id, completed_at FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
        if (!visit.rows.length || visit.rows[0].completed_at) {
            await client.query('ROLLBACK');
            return res.status(visit.rows.length ? 409 : 404).json({ error: visit.rows.length ? 'Visit is already completed' : 'Visit not found' });
        }
        const existing = await client.query('SELECT * FROM visit_stations WHERE visit_id = $1 ORDER BY position, id', [visitId]);
        const plan = planStationRoute(existing.rows, req.body);
        if (plan.error) {
            await client.query('ROLLBACK');
            return res.status(plan.status).json({ error: plan.error });
        }
        const { wanted, previousCurrent, reopened } = plan;
        // Save the original completion/arrival timestamps before reopening or removing
        // a station. Clinical forms are deliberately untouched by route edits.
        await client.query(
            'INSERT INTO visit_station_route_history (visit_id, previous_stations, requested_stations, last_updated_by) VALUES ($1, $2::jsonb, $3::jsonb, $4)',
            [visitId, JSON.stringify(existing.rows), JSON.stringify(wanted), userId]
        );
        await client.query(
            'DELETE FROM visit_stations WHERE visit_id = $1 AND completed_at IS NULL AND NOT (station = ANY($2::text[]))',
            [visitId, wanted]
        );
        for (const [index, station] of wanted.entries()) {
            const old = existing.rows.find(row => row.station === station);
            // Keep arrival time only if the patient stays at the same active station.
            // A deferred station gets a new arrival when it becomes current again.
            const enteredAt = index === 0 && station === previousCurrent ? old?.entered_at : null;
            await client.query(
                `INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
                 VALUES ($1, $2, $3, CASE WHEN $4 THEN COALESCE($5::timestamp, NOW()) ELSE NULL END, $6)
                 ON CONFLICT (visit_id, station) DO UPDATE SET
                    position = EXCLUDED.position, entered_at = EXCLUDED.entered_at, completed_at = NULL,
                    last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()`,
                [visitId, station, index + 1, index === 0, enteredAt, userId]
            );
        }
        if (wanted.includes(TB_STATION) && (!existing.rows.some(row => row.station === TB_STATION) || reopened.includes(TB_STATION))) {
            await flagTb(client, visitId, {}, userId);
        }
        await client.query('UPDATE visits SET last_updated_by = $2, last_updated_at = NOW() WHERE id = $1', [visitId, userId]);
        await client.query('COMMIT');
        res.status(200).json({ visit_id: visitId, current_station: wanted[0], stations: [...existing.rows.filter(row => row.completed_at && !wanted.includes(row.station)).map(row => row.station), ...wanted], reopened_stations: reopened });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Error updating visit stations:', err);
        res.status(500).json({ error: 'Unable to update stations' });
    } finally {
        client.release();
    }
});

// POST /api/queue/:visitId/complete - Discharge: remove the visit from every queue
router.post('/:visitId/complete', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = Number(req.params.visitId);
    const last_updated_by = req.user && req.user.id;

    if (!Number.isInteger(visitId) || visitId < 1) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }

    if (!last_updated_by) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const result = await db.query(
            `
            UPDATE visits
            SET completed_at = COALESCE(completed_at, NOW()),
                last_updated_by = $1,
                last_updated_at = NOW()
            WHERE id = $2
            RETURNING id, completed_at, last_updated_at, last_updated_by
            `,
            [last_updated_by, visitId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        res.status(200).json({ visit: result.rows[0] });
    } catch (err) {
        console.error('Error completing queue visit:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
