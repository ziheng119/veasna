// routes/family.js
// Grouping today's patients into families (visits.family, see utils/family.js). Queue numbers are
// not changed. Anyone may do it: it is how registration staff group a family after registering each
// member. Members waiting at the same station move on together (utils/familyMoves.js).
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { toPositiveInt } = require('../utils/validation');
const { nextFamilyLetters } = require('../utils/family');
const { lockFamilies, visitLocation, releaseFamily, releaseAlone } = require('../utils/familyMoves');

const VISIT_NOT_FOUND = { status: 404, body: { error: 'Visit not found. It may have been deleted on another device.' } };

// Runs work(client) in a transaction; work returns { status, body } to send.
async function inTransaction(res, what, work) {
    let client;
    try {
        client = await db.pool.connect();
    } catch (err) {
        console.error('Failed to acquire database connection:', err);
        return res.status(500).json({ error: 'Database connection unavailable' });
    }
    try {
        await client.query('BEGIN');
        const { status, body } = await work(client);
        await client.query(status < 400 ? 'COMMIT' : 'ROLLBACK');
        res.status(status).json(body);
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error(`Error ${what}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
}

// Locks the visits (in id order, after the location's family lock) and returns them.
async function lockVisits(client, ids) {
    const locationId = await visitLocation(client, ids[0]);
    if (locationId === null) return [];
    await lockFamilies(client, locationId);
    const { rows } = await client.query(
        `SELECT id, queue_no, family, location_id, TO_CHAR(visit_date, 'YYYY-MM-DD') AS visit_date
         FROM visits WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
        [ids]
    );
    return rows;
}

async function setFamily(client, visit, family, userId) {
    await client.query(
        'UPDATE visits SET family = $2, last_updated_by = $3, last_updated_at = NOW() WHERE id = $1',
        [visit.id, family, userId]
    );
}

// POST /api/family - Body: { visit_id, with_visit_id }
// Puts visit_id in with_visit_id's family. When with_visit_id has no family, it joins visit_id's
// family instead, or both start a new family (the next free letter that day). Both visits must be
// at the same location on the same day. Returns { family, visits: [{ visit_id, queue_no, family }] }.
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.body.visit_id);
    const withVisitId = toPositiveInt(req.body.with_visit_id);
    if (!visitId || !withVisitId) return res.status(400).json({ error: 'visit_id and with_visit_id must be positive integers' });
    if (visitId === withVisitId) return res.status(400).json({ error: 'Choose another patient to group with.' });

    await inTransaction(res, 'grouping a family', async (client) => {
        const rows = await lockVisits(client, [visitId, withVisitId]);
        const visit = rows.find((row) => row.id === visitId);
        const other = rows.find((row) => row.id === withVisitId);
        if (!visit || !other) return VISIT_NOT_FOUND;
        if (visit.location_id !== other.location_id || visit.visit_date !== other.visit_date) {
            return { status: 400, body: { error: 'Both patients must be in the same day\'s queue at the same location.' } };
        }

        let family = other.family || visit.family;
        if (!family) {
            const { rows: day } = await client.query(
                'SELECT DISTINCT family FROM visits WHERE location_id = $1 AND visit_date = $2::date AND family IS NOT NULL',
                [visit.location_id, visit.visit_date]
            );
            family = nextFamilyLetters(day.map((row) => row.family));
        }
        const left = [];
        for (const row of [visit, other]) {
            if (row.family === family) continue;
            if (row.family) left.push(row.family);
            await setFamily(client, row, family, req.user.id);
        }
        // A member done at a station may now have no one left to wait for in its old family, or
        // may complete the group waiting at its station in the new one.
        for (const changed of [...left, family]) await releaseFamily(client, visit, changed, req.user.id);
        return {
            status: 200,
            body: {
                family,
                visits: [visit, other].map((row) => ({ visit_id: row.id, queue_no: row.queue_no, family })),
            },
        };
    });
});

// POST /api/family/leave - Body: { visit_id }
// Takes the visit out of its family; its queue number stays. The rest of the family stays together.
router.post('/leave', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.body.visit_id);
    if (!visitId) return res.status(400).json({ error: 'visit_id must be a positive integer' });

    await inTransaction(res, 'leaving a family', async (client) => {
        const [visit] = await lockVisits(client, [visitId]);
        if (!visit) return VISIT_NOT_FOUND;
        if (visit.family) {
            await setFamily(client, visit, null, req.user.id);
            // Whoever was waiting only for this patient moves on, and so does this patient if done here.
            await releaseFamily(client, visit, visit.family, req.user.id);
            await releaseAlone(client, visitId, req.user.id);
        }
        return { status: 200, body: { visit_id: visitId, queue_no: visit.queue_no, family: null } };
    });
});

module.exports = router;
