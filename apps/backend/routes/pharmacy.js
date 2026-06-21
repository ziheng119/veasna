const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../routes/auth'); // Assuming auth.js is in routes folder

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

// POST a new drug to the pharmacy (addDrug)
router.post('/', authenticateToken, async (req, res) => {
    const { location_id, drug_name, stock_level } = req.body;
    const last_updated_by = req.user.id; // From the verified token

    if (!location_id || !drug_name || !stock_level) {
        return res.status(400).json({ error: 'location_id, drug_name, and stock_level are required' });
    }

    try {
        const query = `
            INSERT INTO pharmacy (location_id, drug_name, stock_level, last_updated_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const { rows } = await db.query(query, [location_id, drug_name, stock_level, last_updated_by]);
        res.status(201).json(rows[0]);
    } catch (err) {
        // Handle unique constraint violation (drug already exists at that location)
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This drug already exists at this location.' });
        }
        console.error('Error adding drug:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH an existing drug's stock level (updateDrug)
router.patch('/:drugId', authenticateToken, async (req, res) => {
    const { drugId } = req.params;
    const { stock_level } = req.body;
    const last_updated_by = req.user.id;

    if (!stock_level) {
        return res.status(400).json({ error: 'stock_level is required' });
    }

    try {
        const query = `
            UPDATE pharmacy
            SET stock_level = $1, last_updated_at = NOW(), last_updated_by = $2
            WHERE id = $3
            RETURNING *;
        `;
        const { rows, rowCount } = await db.query(query, [stock_level, last_updated_by, drugId]);
        
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Drug not found' });
        }
        
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Error updating drug stock:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE a drug from the pharmacy (deleteDrug)
router.delete('/:drugId', authenticateToken, async (req, res) => {
    const { drugId } = req.params;

    try {
        const { rowCount } = await db.query('DELETE FROM pharmacy WHERE id = $1', [drugId]);

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Drug not found' });
        }

        res.status(204).send(); // 204 No Content is standard for a successful delete
    } catch (err) {
        console.error('Error deleting drug:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


module.exports = router;