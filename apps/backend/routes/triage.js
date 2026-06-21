const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('./auth');

// UPSERT Visual Acuity (Snellen's Test)
router.post('/visual-acuity', authenticateToken, async (req, res) => {
    const { visit_id, left_with_pinhole, left_without_pinhole, right_with_pinhole, right_without_pinhole, notes } = req.body;
    const last_updated_by = req.user.id;
    const query = `
        INSERT INTO visual_acuity (visit_id, left_with_pinhole, left_without_pinhole, right_with_pinhole, right_without_pinhole, notes, last_updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (visit_id) DO UPDATE SET
            left_with_pinhole = EXCLUDED.left_with_pinhole,
            left_without_pinhole = EXCLUDED.left_without_pinhole,
            right_with_pinhole = EXCLUDED.right_with_pinhole,
            right_without_pinhole = EXCLUDED.right_without_pinhole,
            notes = EXCLUDED.notes,
            last_updated_by = EXCLUDED.last_updated_by,
            last_updated_at = NOW()
        RETURNING *;
    `;
    try {
        const { rows } = await db.query(query, [visit_id, left_with_pinhole, left_without_pinhole, right_with_pinhole, right_without_pinhole, notes, last_updated_by]);
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error upserting visual acuity:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// UPSERT Presenting Complaint
router.post('/presenting-complaint', authenticateToken, async (req, res) => {
    const { visit_id, history, red_flags, systems_review, drug_allergies } = req.body;
    const last_updated_by = req.user.id;
    const query = `
        INSERT INTO presenting_complaint (visit_id, history, red_flags, systems_review, drug_allergies, last_updated_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (visit_id) DO UPDATE SET
            history = EXCLUDED.history, red_flags = EXCLUDED.red_flags, systems_review = EXCLUDED.systems_review, 
            drug_allergies = EXCLUDED.drug_allergies, last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()
        RETURNING *;
    `;
    try {
        const { rows } = await db.query(query, [visit_id, history, red_flags, systems_review, drug_allergies, last_updated_by]);
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error upserting presenting complaint:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// UPSERT Medical History
router.post('/history', authenticateToken, async (req, res) => {
    const { visit_id, past, drug_and_treatment, family, social, systems_review } = req.body;
    const last_updated_by = req.user.id;
    const query = `
        INSERT INTO history (visit_id, past, drug_and_treatment, family, social, systems_review, last_updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (visit_id) DO UPDATE SET
            past = EXCLUDED.past, drug_and_treatment = EXCLUDED.drug_and_treatment, family = EXCLUDED.family, social = EXCLUDED.social,
            systems_review = EXCLUDED.systems_review, last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()
        RETURNING *;
    `;
    try {
        const { rows } = await db.query(query, [visit_id, past, drug_and_treatment, family, social, systems_review, last_updated_by]);
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error upserting history:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;