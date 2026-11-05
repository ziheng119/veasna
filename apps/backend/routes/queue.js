// routes/queue.js
const express = require('express');
const router = express.Router();
const { integerParams, toPositiveInt, isIsoDate } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['visitId']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { currentVisitDate, getNextQueueNo } = require('../utils/queueNumber');
const { STATIONS } = require('../utils/stations');
const { planStationRoute, setStationNeeded } = require('../utils/stationRoute');
const { isTbVisit, TB_ROUTE_LOCKED_ERROR } = require('../utils/tb');
const { lockFamilies, visitLocation, advanceVisit, releaseFamily } = require('../utils/familyMoves');

// GET /api/queue?location_id=...&date=...[&station=...]
// Without station: every visit still in the clinic. With station: only the visits currently
// waiting at that station, in the order they arrived there.
router.get('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const location_id = toPositiveInt(req.query.location_id);
    // Defaults to the host's clinic day, the same date registration assigns to new visits.
    const date = req.query.date || currentVisitDate();
    const station = req.query.station || null;

    if (!location_id) {
        return res.status(400).json({ error: 'location_id must be a positive integer' });
    }

    if (!isIsoDate(date)) {
        return res.status(400).json({ error: 'date must be a valid YYYY-MM-DD date' });
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
                p.family,
                p.english_name,
                p.khmer_name,
                p.sex,
                EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age,
                TO_CHAR(v.created_at, 'HH:MI AM') AS timestamp,
                -- Display the same station-arrival value used by the queue ordering.
                TO_CHAR(COALESCE(cur.entered_at, v.created_at), 'HH:MI AM') AS station_arrival_time,
                cur.station AS current_station,
                -- Done here and waiting for the rest of the family at this station.
                cur.family_ready_at IS NOT NULL AS family_waiting,
                tb.status AS tb_status,
                -- Suspected TB: shown in red in every queue so doctors can attend to the patient.
                COALESCE(tb.status IN ('suspected', 'tb_likely'), FALSE) AS tb_flagged,
                -- Done at the current station: its form is saved (every Triage section), or at
                -- Pharmacy nothing is left to dispense. The app then offers to send the patient on.
                CASE cur.station
                    WHEN 'triage' THEN EXISTS (SELECT 1 FROM visual_acuity x WHERE x.visit_id = v.id)
                        AND EXISTS (SELECT 1 FROM presenting_complaint x WHERE x.visit_id = v.id)
                        AND EXISTS (SELECT 1 FROM history x WHERE x.visit_id = v.id)
                    WHEN 'consultation' THEN EXISTS (SELECT 1 FROM consultation x WHERE x.visit_id = v.id)
                    WHEN 'physiotherapy' THEN EXISTS (SELECT 1 FROM physiotherapy x WHERE x.visit_id = v.id)
                    WHEN 'dental' THEN EXISTS (SELECT 1 FROM dental x WHERE x.visit_id = v.id)
                    WHEN 'seva' THEN EXISTS (SELECT 1 FROM seva x WHERE x.visit_id = v.id)
                    WHEN 'pharmacy' THEN NOT EXISTS (SELECT 1 FROM prescriptions x WHERE x.visit_id = v.id AND x.status = 'pending')
                    ELSE FALSE
                END AS station_done,
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
                SELECT s.station, s.entered_at, s.family_ready_at
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
    const locationId = toPositiveInt(req.query.location_id);

    if (!locationId) {
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
// A family member waits at the station until every member of the family there is done; then they
// all move on together (utils/familyMoves.js). Returns { visit_id, completed_station, next_station,
// held, waiting_for, family_moved }: held is true while waiting, waiting_for lists who is not done.
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

    let client;
    try {
        client = await db.pool.connect();
    } catch (err) {
        console.error('Failed to acquire database connection:', err);
        return res.status(500).json({ error: 'Database connection unavailable' });
    }
    try {
        await client.query('BEGIN');

        const locationId = await visitLocation(client, visitId);
        if (locationId === null) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found' });
        }
        // Family moves lock every member, so the family lock comes before this visit's row lock.
        await lockFamilies(client, locationId);
        // Lock the visit so two devices cannot advance it at the same time
        const visit = await client.query(
            `SELECT v.id, v.completed_at, p.family, v.location_id, TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date
             FROM visits v JOIN patients p ON p.id = v.patient_id WHERE v.id = $1 FOR UPDATE OF v`,
            [visitId]
        );
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

        const { family } = visit.rows[0];
        let body;
        if (!family) {
            const next = await advanceVisit(client, visitId, last_updated_by);
            body = { visit_id: visitId, completed_station: station, next_station: next, held: false, waiting_for: [], family_moved: [] };
        } else {
            await client.query(
                'UPDATE visit_stations SET family_ready_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2',
                [last_updated_by, pending.rows[0].id]
            );
            const { moved, members } = await releaseFamily(client, visit.rows[0], family, last_updated_by);
            const mine = moved.find((member) => member.visit_id === visitId);
            const waitingFor = mine ? [] : members
                .filter((member) => member.station === station && !member.ready)
                .map(({ visit_id, queue_no, english_name }) => ({ visit_id, queue_no, english_name }));
            body = {
                visit_id: visitId,
                completed_station: station,
                next_station: mine ? mine.next_station : null,
                held: !mine,
                waiting_for: waitingFor,
                family_moved: moved.filter((member) => member.visit_id !== visitId),
            };
        }

        await client.query('COMMIT');
        res.status(200).json(body);
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
// A visit that was ever flagged for TB only goes to Consultation: its route is refused (409).
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
        const locationId = await visitLocation(client, visitId);
        if (locationId !== null) await lockFamilies(client, locationId);
        // This is the same row lock used by station completion, so routing cannot
        // race with another device moving or discharging the patient.
        const visit = await client.query(
            `SELECT v.id, v.completed_at, p.family, v.location_id, TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date
             FROM visits v JOIN patients p ON p.id = v.patient_id WHERE v.id = $1 FOR UPDATE OF v`,
            [visitId]
        );
        if (!visit.rows.length || visit.rows[0].completed_at) {
            await client.query('ROLLBACK');
            return res.status(visit.rows.length ? 409 : 404).json({ error: visit.rows.length ? 'Visit is already completed' : 'Visit not found' });
        }
        if (await isTbVisit(client, visitId)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: TB_ROUTE_LOCKED_ERROR });
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
            const stays = index === 0 && station === previousCurrent;
            const enteredAt = stays ? old?.entered_at : null;
            // Waiting for family is kept only while the patient stays at the same station.
            await client.query(
                `INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
                 VALUES ($1, $2, $3, CASE WHEN $4 THEN COALESCE($5::timestamp, NOW()) ELSE NULL END, $6)
                 ON CONFLICT (visit_id, station) DO UPDATE SET
                    position = EXCLUDED.position, entered_at = EXCLUDED.entered_at, completed_at = NULL,
                    family_ready_at = CASE WHEN $7 THEN visit_stations.family_ready_at END,
                    last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()`,
                [visitId, station, index + 1, index === 0, enteredAt, userId, stays]
            );
        }
        await client.query('UPDATE visits SET last_updated_by = $2, last_updated_at = NOW() WHERE id = $1', [visitId, userId]);
        // Sending a family member elsewhere may leave the rest of the family at the old station all done.
        await releaseFamily(client, visit.rows[0], visit.rows[0].family, userId);
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

// PUT /api/queue/:visitId/stations/:station - Body: { needed: boolean }
// Adds one station to the remaining route in clinic order, or removes it: the partner NGO at
// Triage, Physiotherapy at Consultation. Refused (409) for a TB visit, whose route is fixed, and in
// the cases described at setStationNeeded. Returns { visit_id, stations } (the remaining route).
router.put('/:visitId/stations/:station', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.params.visitId);
    const { station } = req.params;
    const { needed } = req.body;
    if (!visitId) return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    // Pharmacy is added by prescribing, not by hand.
    if (!STATIONS.includes(station) || station === 'pharmacy') {
        return res.status(400).json({ error: `station must be one of: ${STATIONS.filter(s => s !== 'pharmacy').join(', ')}` });
    }
    if (typeof needed !== 'boolean') return res.status(400).json({ error: 'needed must be true or false' });

    let client;
    try {
        client = await db.pool.connect();
    } catch (err) {
        console.error('Failed to acquire database connection:', err);
        return res.status(500).json({ error: 'Database connection unavailable' });
    }
    try {
        await client.query('BEGIN');
        const visit = await client.query('SELECT id FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
        if (!visit.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found' });
        }
        if (await isTbVisit(client, visitId)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: TB_ROUTE_LOCKED_ERROR });
        }
        const result = await setStationNeeded(client, visitId, station, needed, req.user.id);
        if (result.error) {
            await client.query('ROLLBACK');
            return res.status(result.status).json({ error: result.error });
        }
        await client.query('UPDATE visits SET last_updated_by = $2, last_updated_at = NOW() WHERE id = $1', [visitId, req.user.id]);
        await client.query('COMMIT');
        res.status(200).json({ visit_id: visitId, stations: result.stations });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Error updating a visit station:', err);
        res.status(500).json({ error: 'Unable to update stations' });
    } finally {
        client.release();
    }
});

// POST /api/queue/:visitId/complete - Discharge: remove the visit from every queue.
// Family members who were waiting only for this patient move on.
router.post('/:visitId/complete', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = Number(req.params.visitId);
    const last_updated_by = req.user && req.user.id;

    if (!Number.isInteger(visitId) || visitId < 1) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }

    if (!last_updated_by) {
        return res.status(401).json({ error: 'Authentication required' });
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
        const locationId = await visitLocation(client, visitId);
        if (locationId !== null) await lockFamilies(client, locationId);
        const result = await client.query(
            `
            UPDATE visits
            SET completed_at = COALESCE(completed_at, NOW()),
                last_updated_by = $1,
                last_updated_at = NOW()
            WHERE id = $2
            RETURNING id, completed_at, last_updated_at, last_updated_by, location_id,
                TO_CHAR(visit_date, 'YYYY-MM-DD') AS visit_date,
                (SELECT family FROM patients WHERE patients.id = visits.patient_id) AS family
            `,
            [last_updated_by, visitId]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found' });
        }
        const { family, location_id, visit_date, ...visit } = result.rows[0];
        await releaseFamily(client, { location_id, visit_date }, family, last_updated_by);
        await client.query('COMMIT');
        res.status(200).json({ visit });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Error completing queue visit:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
