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
            WHERE v.location_id = $1 AND v.visit_date::date = $2::date
            ORDER BY v.created_at ASC;
        `;
        const result = await db.query(queryText, [location_id, date]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching queue:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;