// routes/family.js
// Grouping today's patients into families by a shared queue number letter (see utils/family.js).
// Anyone may do it: it is how registration staff group a family after registering each member.
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { toPositiveInt } = require('../utils/validation');
const { lockQueue } = require('../utils/queueNumber');
const { splitQueueNo, nextFamilyLetters } = require('../utils/family');

const NOT_GROUPABLE = 'Queue numbers that start with a letter can\'t join a family. Ask an admin to correct the number first.';

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

// Another visit that day at the location already has one of these numbers, e.g. an older typed
// "3A" next to the 3 being grouped. Queue numbers are kept unique by the app, not a constraint.
// changes: [{ visit, queueNo }]; each new number is checked against every other visit that day.
async function clash(client, changes) {
    for (const { visit, queueNo } of changes) {
        if (queueNo === visit.queue_no) continue;
        const { rows } = await client.query(
            `SELECT 1 FROM visits WHERE location_id = $1 AND visit_date = $2::date AND UPPER(queue_no) = $3 AND id <> $4 LIMIT 1`,
            [visit.location_id, visit.visit_date, queueNo, visit.id]
        );
        if (rows.length) {
            return { status: 409, body: { error: `Queue number ${queueNo} is already used today. Ask an admin to correct the numbers.` } };
        }
    }
    return null;
}

async function setQueueNo(client, visit, queueNo, userId) {
    if (queueNo === visit.queue_no) return;
    await client.query(
        'UPDATE visits SET queue_no = $2, last_updated_by = $3, last_updated_at = NOW() WHERE id = $1',
        [visit.id, queueNo, userId]
    );
}

// POST /api/family - Body: { visit_id, with_visit_id }
// Puts visit_id in with_visit_id's family, or starts a new family (the next free letter) for both
// when with_visit_id has none. Both visits must be at the same location on the same day.
// Returns { family, visits: [{ visit_id, queue_no }] } with the new numbers.
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.body.visit_id);
    const withVisitId = toPositiveInt(req.body.with_visit_id);
    if (!visitId || !withVisitId) return res.status(400).json({ error: 'visit_id and with_visit_id must be positive integers' });
    if (visitId === withVisitId) return res.status(400).json({ error: 'Choose another patient to group with.' });

    await inTransaction(res, 'grouping a family', async (client) => {
        // Locked in id order, so two requests on the same pair cannot deadlock.
        const { rows } = await client.query(
            `SELECT id, queue_no, location_id, TO_CHAR(visit_date, 'YYYY-MM-DD') AS visit_date
             FROM visits WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
            [[visitId, withVisitId]]
        );
        const visit = rows.find((row) => row.id === visitId);
        const other = rows.find((row) => row.id === withVisitId);
        if (!visit || !other) return { status: 404, body: { error: 'Visit not found. It may have been deleted on another device.' } };
        if (visit.location_id !== other.location_id || visit.visit_date !== other.visit_date) {
            return { status: 400, body: { error: 'Both patients must be in the same day\'s queue at the same location.' } };
        }
        const mine = splitQueueNo(visit.queue_no);
        const theirs = splitQueueNo(other.queue_no);
        if (!mine || !theirs) return { status: 400, body: { error: NOT_GROUPABLE } };

        // Held until commit, like registration, so two devices cannot take the same new letter.
        await lockQueue(client, visit.location_id);
        let family = theirs.letters;
        if (!family) {
            const { rows: day } = await client.query(
                'SELECT queue_no FROM visits WHERE location_id = $1 AND visit_date = $2::date',
                [visit.location_id, visit.visit_date]
            );
            family = nextFamilyLetters(day.map((row) => row.queue_no));
        }
        const conflict = await clash(client, [
            { visit: other, queueNo: theirs.base + family },
            { visit, queueNo: mine.base + family },
        ]);
        if (conflict) return conflict;
        await setQueueNo(client, other, theirs.base + family, req.user.id);
        await setQueueNo(client, visit, mine.base + family, req.user.id);
        return {
            status: 200,
            body: {
                family,
                visits: [
                    { visit_id: visit.id, queue_no: mine.base + family },
                    { visit_id: other.id, queue_no: theirs.base + family },
                ],
            },
        };
    });
});

// POST /api/family/leave - Body: { visit_id }
// Takes the visit out of its family: 4A becomes 4 again. The rest of the family keeps its letter.
router.post('/leave', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.body.visit_id);
    if (!visitId) return res.status(400).json({ error: 'visit_id must be a positive integer' });

    await inTransaction(res, 'leaving a family', async (client) => {
        const { rows } = await client.query(
            `SELECT id, queue_no, location_id, TO_CHAR(visit_date, 'YYYY-MM-DD') AS visit_date FROM visits WHERE id = $1 FOR UPDATE`,
            [visitId]
        );
        if (!rows.length) return { status: 404, body: { error: 'Visit not found. It may have been deleted on another device.' } };
        const parts = splitQueueNo(rows[0].queue_no);
        if (!parts) return { status: 400, body: { error: NOT_GROUPABLE } };
        await lockQueue(client, rows[0].location_id);
        const conflict = await clash(client, [{ visit: rows[0], queueNo: parts.base }]);
        if (conflict) return conflict;
        await setQueueNo(client, rows[0], parts.base, req.user.id);
        return { status: 200, body: { visit_id: visitId, queue_no: parts.base } };
    });
});

module.exports = router;
