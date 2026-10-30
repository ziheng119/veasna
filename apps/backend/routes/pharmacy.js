const express = require('express');
const router = express.Router();
const { integerParams, toPositiveInt, toCount } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['drugId']);
const db = require('../config/db');
const { authenticateToken } = require('../routes/auth');
const { ensurePharmacyNumericStock } = require('../utils/ensureSchema');

router.use(async (req, res, next) => {
    try {
        await ensurePharmacyNumericStock();
        next();
    } catch (err) {
        console.error('Pharmacy schema migration failed:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET all drugs for a specific location
router.get('/', authenticateToken, async (req, res) => {
    const location_id = toPositiveInt(req.query.location_id);

    if (!location_id) {
        return res.status(400).json({ error: 'location_id must be a positive integer' });
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
    const location_id = toPositiveInt(req.query.location_id);

    if (!location_id) {
        return res.status(400).json({ error: 'location_id must be a positive integer' });
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
    const { drug_name, stock_count } = req.body;
    const location_id = toPositiveInt(req.body.location_id);
    const last_updated_by = req.user.id;

    if (!location_id || typeof drug_name !== 'string' || !drug_name.trim() || stock_count === undefined || stock_count === null) {
        return res.status(400).json({ error: 'location_id, drug_name, and stock_count are required' });
    }

    const count = toCount(stock_count);
    if (count === null) {
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
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Location not found' });
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

    const count = toCount(stock_count);
    if (count === null) {
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

// POST dispense: subtracts in one statement, so two devices dispensing the same drug at
// once both count (setting an absolute stock_count from a stale page would lose one).
router.post('/:drugId/dispense', authenticateToken, async (req, res) => {
    const quantity = toPositiveInt(req.body.quantity);
    if (!quantity) {
        return res.status(400).json({ error: 'quantity must be a positive integer' });
    }

    try {
        const { rows } = await db.query(
            `UPDATE pharmacy
             SET stock_count = stock_count - $1, last_updated_at = NOW(), last_updated_by = $2
             WHERE id = $3 AND stock_count >= $1
             RETURNING *`,
            [quantity, req.user.id, req.params.drugId]
        );
        if (rows.length) return res.status(200).json(rows[0]);

        const current = await db.query('SELECT stock_count FROM pharmacy WHERE id = $1', [req.params.drugId]);
        if (!current.rows.length) return res.status(404).json({ error: 'Drug not found' });
        res.status(409).json({
            error: `Only ${current.rows[0].stock_count} left in stock. Another device may have dispensed it.`,
            stock_count: current.rows[0].stock_count,
        });
    } catch (err) {
        console.error('Error dispensing drug:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH an existing drug's name
router.patch('/:drugId/name', authenticateToken, async (req, res) => {
    const { drugId } = req.params;
    const { drug_name } = req.body;
    const last_updated_by = req.user.id;

    if (typeof drug_name !== 'string' || !drug_name.trim()) {
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

const { requireRole } = require('../routes/auth');

// DELETE a drug from the pharmacy
router.delete('/:drugId', authenticateToken, requireRole(['admin']), async (req, res) => {
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
