// routes/tb.js
// Suspected-TB flag on a visit. A flagged patient goes only to the Consultation queue and is
// shown in red in every queue, so a doctor sees them first (see utils/tb.js).
const express = require('express');
const router = express.Router();
const { integerParams, toPositiveInt } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['visitId']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { TB_FLAGGED_STATUSES, TB_MIN_RED_FLAGS, TB_MIN_RED_FLAGS_ERROR, normalizeRedFlags, flagTb, clearTbFlag, sendToConsultation } = require('../utils/tb');
const { textOrEmpty } = require('../utils/partialFields');
const { canEditSavedRecords } = require('../utils/permissions');

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
// Flagging needs at least TB_MIN_RED_FLAGS red flags (3).
// Anyone may flag a patient (e.g. at triage). The flag is cleared at Consult, by the doctor who saw
// the patient: clearing is refused (409) unless the visit is waiting at Consultation. Admins
// correct other visits' flags on Patient Details (PUT /api/visits/:visitId/tb). Flagging or
// clearing makes Consultation the patient's only remaining station. Sending flagged=true again changes an
// existing flag's red flags or notes, like any saved-record edit (utils/permissions.js
// canEditSavedRecords). Clearing a visit that is not flagged changes nothing.
// Responds with the screening, `flagged`, and the visit's `current_station` afterwards.
router.post('/:visitId/flag', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.params.visitId);
    const { flagged } = req.body;
    const redFlags = normalizeRedFlags(req.body.red_flags);
    const canEdit = canEditSavedRecords(req.user.role);

    if (!visitId) {
        return res.status(400).json({ error: 'Visit ID must be a positive integer' });
    }
    if (typeof flagged !== 'boolean') {
        return res.status(400).json({ error: 'flagged must be true or false' });
    }
    if (redFlags === null) {
        return res.status(400).json({ error: 'red_flags must be a list of text' });
    }
    if (flagged && redFlags.length < TB_MIN_RED_FLAGS) {
        return res.status(400).json({ error: TB_MIN_RED_FLAGS_ERROR });
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
        if (!visit.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Visit not found. It may have been deleted on another device.' });
        }
        const existing = await client.query('SELECT status FROM tb_screening WHERE visit_id = $1', [visitId]);
        const wasFlagged = TB_FLAGGED_STATUSES.includes(existing.rows[0]?.status);

        if (!canEdit && flagged && wasFlagged) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'This account cannot change the red flags or notes of a TB flag.' });
        }
        // Already cleared, e.g. by another doctor a moment ago: keep their attribution.
        if (!flagged && !wasFlagged) {
            await client.query('ROLLBACK');
            return res.status(200).json({ visit_id: visitId, status: existing.rows[0]?.status ?? null, flagged: false });
        }

        if (!flagged) {
            const { rows } = await client.query(
                'SELECT station FROM visit_stations WHERE visit_id = $1 AND completed_at IS NULL ORDER BY position, id LIMIT 1',
                [visitId]
            );
            if (visit.rows[0].completed_at || rows[0]?.station !== 'consultation') {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'The TB flag is cleared at Consult, while the patient is waiting there.' });
            }
        }

        const screening = flagged
            ? await flagTb(client, visitId, { redFlags, notes: textOrEmpty(req.body.notes) }, req.user.id)
            : await clearTbFlag(client, visitId, req.user.id);
        // A new flag or a cleared one fixes the route to Consultation; editing a flag's details does not.
        const currentStation = flagged && wasFlagged ? undefined : await sendToConsultation(client, visitId, req.user.id);
        await client.query('UPDATE visits SET last_updated_by = $2, last_updated_at = NOW() WHERE id = $1', [visitId, req.user.id]);
        await client.query('COMMIT');
        // current_station is left out when only a flag's details were edited.
        res.status(200).json({ ...screening, flagged: TB_FLAGGED_STATUSES.includes(screening.status), current_station: currentStation });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error('Error updating TB flag:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
