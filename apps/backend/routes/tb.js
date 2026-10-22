// routes/tb.js
// TB tent: screening details for flagged visits and the TB doctor's decision.
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { TB_STATION } = require('../utils/tb');

const TB_DECISIONS = ['cleared', 'tb_likely'];

function parseVisitId(value) {
    const visitId = Number(value);
    return Number.isInteger(visitId) && visitId > 0 ? visitId : null;
}

// GET /api/tb/:visitId - TB screening for a visit, or null when the visit was never flagged
router.get('/:visitId', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = parseVisitId(req.params.visitId);
    if (!visitId) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }

    try {
        const { rows } = await db.query(
            `SELECT tb.visit_id, tb.red_flags, tb.flag_notes, tb.status, tb.doctor_notes,
                    tb.flagged_at, fu.username AS flagged_by,
                    tb.reviewed_at, ru.username AS reviewed_by,
                    tb.last_updated_at
             FROM tb_screening tb
             LEFT JOIN users fu ON fu.id = tb.flagged_by
             LEFT JOIN users ru ON ru.id = tb.reviewed_by
             WHERE tb.visit_id = $1`,
            [visitId]
        );
        res.status(200).json(rows[0] || null);
    } catch (err) {
        console.error('Error fetching TB screening:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/tb/:visitId/review - TB doctor's decision. Body: { decision, doctor_notes }
//   cleared   = no TB: the patient leaves the TB tent for their next station (or the visit ends).
//   tb_likely = TB not ruled out: the patient stays at the TB tent until discharged.
router.post('/:visitId/review', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = parseVisitId(req.params.visitId);
    const { decision } = req.body;
    const doctorNotes = typeof req.body.doctor_notes === 'string' ? req.body.doctor_notes : '';
    const last_updated_by = req.user.id;

    if (!visitId) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }
    if (!TB_DECISIONS.includes(decision)) {
        return res.status(400).json({ error: `decision must be one of: ${TB_DECISIONS.join(', ')}` });
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

        const existingReview = await client.query('SELECT reviewed_at FROM tb_screening WHERE visit_id = $1', [visitId]);
        if (req.user.role !== 'admin' && existingReview.rows[0]?.reviewed_at) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Only admins can edit a saved TB review.' });
        }

        const pending = await client.query(
            'SELECT id, station FROM visit_stations WHERE visit_id = $1 AND completed_at IS NULL ORDER BY position',
            [visitId]
        );
        if (visit.rows[0].completed_at || pending.rows.length === 0 || pending.rows[0].station !== TB_STATION) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Patient is no longer waiting at the TB tent. Refresh the queue.' });
        }

        const screening = await client.query(
            `UPDATE tb_screening
             SET status = $1, doctor_notes = $2, reviewed_by = $3, reviewed_at = NOW(),
                 last_updated_by = $3, last_updated_at = NOW()
             WHERE visit_id = $4
             RETURNING status`,
            [decision, doctorNotes, last_updated_by, visitId]
        );
        if (screening.rows.length === 0) {
            // TB tent added without a screening row (should not happen); record it now
            await client.query(
                `INSERT INTO tb_screening (visit_id, status, doctor_notes, flagged_by, reviewed_by, reviewed_at, last_updated_by)
                 VALUES ($1, $2, $3, $4, $4, NOW(), $4)`,
                [visitId, decision, doctorNotes, last_updated_by]
            );
        }

        let next = null;
        let visitCompleted = false;
        if (decision === 'cleared') {
            await client.query(
                'UPDATE visit_stations SET completed_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2',
                [last_updated_by, pending.rows[0].id]
            );
            next = pending.rows[1] || null;
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
                visitCompleted = true;
            }
        }

        await client.query('COMMIT');
        res.status(200).json({
            visit_id: visitId,
            status: decision,
            next_station: next ? next.station : null,
            visit_completed: visitCompleted,
        });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Error recording TB review:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
