// routes/tb.js
// Suspected-TB flag on a visit. A flagged patient goes through their normal stations and is shown
// in red in every queue so doctors can attend to them.
const express = require('express');
const router = express.Router();
const { integerParams, toPositiveInt } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['visitId']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { TB_FLAGGED_STATUSES, normalizeRedFlags, flagTb, clearTbFlag } = require('../utils/tb');
const { textOrEmpty } = require('../utils/partialFields');

// GET /api/tb/:visitId - TB screening for a visit, or null when the visit was never flagged
router.get('/:visitId', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.params.visitId);
    if (!visitId) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }

    try {
        const { rows } = await db.query(
            `SELECT tb.visit_id, tb.red_flags, tb.flag_notes, tb.status,
                    tb.status IN ('suspected', 'tb_likely') AS flagged,
                    tb.doctor_notes, tb.flagged_at, fu.username AS flagged_by,
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

// POST /api/tb/:visitId/flag - Body: { flagged: boolean, red_flags?: string[], notes?: string }
// Anyone may flag a patient (e.g. at triage). Changing an existing flag's red flags or notes, or
// removing a flag, is an edit of saved data and needs an admin.
router.post('/:visitId/flag', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.params.visitId);
    const { flagged } = req.body;
    const redFlags = normalizeRedFlags(req.body.red_flags);
    const isAdmin = req.user.role === 'admin';

    if (!visitId) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }
    if (typeof flagged !== 'boolean') {
        return res.status(400).json({ error: 'flagged must be true or false' });
    }
    if (redFlags === null) {
        return res.status(400).json({ error: 'red_flags must be a list of text' });
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
        const visit = await client.query('SELECT id FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
        if (!visit.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found. It may have been deleted on another device.' });
        }
        const existing = await client.query('SELECT status FROM tb_screening WHERE visit_id = $1', [visitId]);
        const wasFlagged = TB_FLAGGED_STATUSES.includes(existing.rows[0]?.status);

        if (!isAdmin && (!flagged || wasFlagged)) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                error: flagged
                    ? 'This patient is already flagged for TB. Ask an admin to change the red flags or notes.'
                    : 'Only an admin can remove a TB flag.',
            });
        }

        const screening = flagged
            ? await flagTb(client, visitId, { redFlags, notes: textOrEmpty(req.body.notes) }, req.user.id)
            : await clearTbFlag(client, visitId, req.user.id);
        await client.query('UPDATE visits SET last_updated_by = $2, last_updated_at = NOW() WHERE id = $1', [visitId, req.user.id]);
        await client.query('COMMIT');
        res.status(200).json(screening
            ? { ...screening, flagged: TB_FLAGGED_STATUSES.includes(screening.status) }
            : { visit_id: visitId, flagged: false });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Error updating TB flag:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
