// routes/queue.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');

// GET /api/queue?location_id=...&date=...
router.get('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const { location_id, date } = req.query;

    if (!location_id || !date) {
        return res.status(400).json({ error: 'location_id and date are required' });
    }

    if (isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'Invalid date format' });
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
                TO_CHAR(v.created_at, 'HH:MI AM') AS timestamp
            FROM visits v
            JOIN patients p ON v.patient_id = p.id
            WHERE v.location_id = $1
              AND v.visit_date::date = $2::date
              AND v.completed_at IS NULL
            ORDER BY v.created_at ASC;
        `;
        const result = await db.query(queryText, [location_id, date]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching queue:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/queue/:visitId/complete - Remove visit from today's active queue
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
