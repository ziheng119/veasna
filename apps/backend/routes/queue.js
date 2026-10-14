// routes/queue.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { currentVisitDate, getNextQueueNo } = require('../utils/queueNumber');
const { STATIONS, normalizeStations, stationPosition } = require('../utils/stations');
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
                cur.station AS current_station,
                tb.status AS tb_status,
                (
                    SELECT COALESCE(json_agg(json_build_object(
                        'station', s.station,
                        'completed', s.completed_at IS NOT NULL
                    ) ORDER BY s.position), '[]'::json)
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

// PUT /api/queue/:visitId/stations - Change which stations a visit still has to go through.
// Body: { stations: [...] } = the stations still to do. Completed stations are kept as they are.
router.put('/:visitId/stations', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = Number(req.params.visitId);
    const last_updated_by = req.user.id;
    const stations = normalizeStations(req.body.stations);

    if (!Number.isInteger(visitId) || visitId < 1) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }
    if (!stations || stations.length === 0) {
        return res.status(400).json({ error: `stations must be a non-empty list of: ${STATIONS.join(', ')}. To end the visit, discharge the patient.` });
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

        const visit = await client.query('SELECT id, completed_at FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
        if (visit.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found' });
        }
        if (visit.rows[0].completed_at) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Visit is already completed' });
        }

        const existing = await client.query(
            'SELECT station, completed_at FROM visit_stations WHERE visit_id = $1',
            [visitId]
        );
        const completed = existing.rows.filter((row) => row.completed_at).map((row) => row.station);
        const pending = existing.rows.filter((row) => !row.completed_at).map((row) => row.station);
        const wanted = stations.filter((station) => !completed.includes(station));
        // A patient on TB hold keeps the TB tent until a TB doctor clears them
        if (pending.includes(TB_STATION) && !wanted.includes(TB_STATION)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: TB_HOLD_MESSAGE, code: 'TB_HOLD' });
        }
        if (wanted.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Every selected station is already completed. To end the visit, discharge the patient.' });
        }

        await client.query(
            'DELETE FROM visit_stations WHERE visit_id = $1 AND completed_at IS NULL AND NOT (station = ANY($2))',
            [visitId, wanted]
        );
        for (const station of wanted.filter((s) => !pending.includes(s))) {
            await client.query(
                'INSERT INTO visit_stations (visit_id, station, position, last_updated_by) VALUES ($1, $2, $3, $4)',
                [visitId, station, stationPosition(station), last_updated_by]
            );
        }
        // Adding the TB tent flags the visit for TB; it becomes the patient's current station
        if (wanted.includes(TB_STATION) && !pending.includes(TB_STATION)) {
            await flagTb(client, visitId, {}, last_updated_by);
        }
        // Whichever station is now first in line is the one the patient is waiting at
        await client.query(
            `UPDATE visit_stations SET entered_at = NOW(), last_updated_by = $2, last_updated_at = NOW()
             WHERE id = (
                 SELECT id FROM visit_stations
                 WHERE visit_id = $1 AND completed_at IS NULL
                 ORDER BY position LIMIT 1
             ) AND entered_at IS NULL`,
            [visitId, last_updated_by]
        );

        await client.query('COMMIT');
        res.status(200).json({ visit_id: visitId, current_station: wanted[0], stations: [...completed, ...wanted] });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Error updating visit stations:', err);
        res.status(500).json({ error: 'Internal server error' });
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
