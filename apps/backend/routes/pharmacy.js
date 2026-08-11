const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../routes/auth');

// GET all drugs for a specific location
router.get('/', authenticateToken, async (req, res) => {
    const { location_id } = req.query;

    if (!location_id) {
        return res.status(400).json({ error: 'location_id is required' });
    }

    try {
        const query = 'SELECT * FROM pharmacy WHERE location_id = $1 ORDER BY drug_name ASC';
        const { rows } = await db.query(query, [location_id]);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching pharmacy stock:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET pharmacy stats for a specific location
router.get('/stats', authenticateToken, async (req, res) => {
    const { location_id } = req.query;

    if (!location_id) {
        return res.status(400).json({ error: 'location_id is required' });
    }

    try {
        const query = `
            SELECT
                COUNT(*)::int AS total_medications,
                COALESCE(SUM(stock_count), 0)::int AS total_stock,
                COUNT(*) FILTER (WHERE stock_count = 0)::int AS out_of_stock,
                COUNT(*) FILTER (WHERE stock_count > 0 AND stock_count <= 20)::int AS low_stock
            FROM pharmacy WHERE location_id = $1;
        `;
        const { rows } = await db.query(query, [location_id]);
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error fetching pharmacy stats:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST a new drug to the pharmacy
router.post('/', authenticateToken, async (req, res) => {
    const { location_id, drug_name, stock_count } = req.body;
    const last_updated_by = req.user.id;

    if (!location_id || !drug_name || !drug_name.trim() || stock_count === undefined || stock_count === null) {
        return res.status(400).json({ error: 'location_id, drug_name, and stock_count are required' });
    }

    const count = parseInt(stock_count, 10);
    if (isNaN(count) || count < 0) {
        return res.status(400).json({ error: 'stock_count must be a non-negative integer' });
    }

    try {
        const query = `
            INSERT INTO pharmacy (location_id, drug_name, stock_count, last_updated_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const { rows } = await db.query(query, [location_id, drug_name.trim(), count, last_updated_by]);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This drug already exists at this location.' });
        }
        console.error('Error adding drug:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH an existing drug's stock count
router.patch('/:drugId', authenticateToken, async (req, res) => {
    const { drugId } = req.params;
    const { stock_count } = req.body;
    const last_updated_by = req.user.id;

    if (stock_count === undefined || stock_count === null) {
        return res.status(400).json({ error: 'stock_count is required' });
    }

    const count = parseInt(stock_count, 10);
    if (isNaN(count) || count < 0) {
        return res.status(400).json({ error: 'stock_count must be a non-negative integer' });
    }

    try {
        const query = `
            UPDATE pharmacy
            SET stock_count = $1, last_updated_at = NOW(), last_updated_by = $2
            WHERE id = $3
            RETURNING *;
        `;
        const { rows, rowCount } = await db.query(query, [count, last_updated_by, drugId]);

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Drug not found' });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error updating drug stock:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH an existing drug's name
router.patch('/:drugId/name', authenticateToken, async (req, res) => {
    const { drugId } = req.params;
    const { drug_name } = req.body;
    const last_updated_by = req.user.id;

    if (!drug_name || !drug_name.trim()) {
        return res.status(400).json({ error: 'drug_name is required' });
    }

    try {
        const query = `
            UPDATE pharmacy
            SET drug_name = $1, last_updated_at = NOW(), last_updated_by = $2
            WHERE id = $3
            RETURNING *;
        `;
        const { rows, rowCount } = await db.query(query, [drug_name.trim(), last_updated_by, drugId]);

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Drug not found' });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A drug with this name already exists at this location.' });
        }
        console.error('Error updating drug name:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE a drug from the pharmacy
router.delete('/:drugId', authenticateToken, async (req, res) => {
    const { drugId } = req.params;

    try {
        const { rowCount } = await db.query('DELETE FROM pharmacy WHERE id = $1', [drugId]);

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Drug not found' });
        }

        res.status(204).send();
    } catch (err) {
        console.error('Error deleting drug:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


module.exports = router;
