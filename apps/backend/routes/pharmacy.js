const express = require('express');
const router = express.Router();
const { integerParams, toPositiveInt, toCount } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['drugId']);
const db = require('../config/db');
const { authenticateToken } = require('../routes/auth');
const { ensurePharmacyNumericStock, ensurePrescriptions } = require('../utils/ensureSchema');
const { RESERVED_SQL, lockDrug } = require('../utils/pharmacyStock');

// Runs `work(client)` in a transaction; `work` returns { status, body } and anything other than
// 2xx rolls back.
async function inTransaction(res, label, work) {
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
        await client.query(status < 300 ? 'COMMIT' : 'ROLLBACK');
        if (status === 204) res.status(204).send();
        else res.status(status).json(body);
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error(`Error ${label}:`, err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        client.release();
    }
}

router.use(async (req, res, next) => {
    try {
        await ensurePharmacyNumericStock();
        await ensurePrescriptions();
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
        // reserved_count: held by pending prescriptions; available_count: what can still be used.
        const query = `
            SELECT p.*, ${RESERVED_SQL} AS reserved_count, p.stock_count - ${RESERVED_SQL} AS available_count
            FROM pharmacy p WHERE p.location_id = $1 ORDER BY p.drug_name ASC`;
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
                COALESCE(SUM(reserved), 0)::int AS total_reserved,
                COUNT(*) FILTER (WHERE stock_count - reserved <= 0)::int AS out_of_stock,
                COUNT(*) FILTER (WHERE stock_count - reserved > 0 AND stock_count - reserved <= 20)::int AS low_stock
            FROM (SELECT p.stock_count, ${RESERVED_SQL} AS reserved FROM pharmacy p WHERE p.location_id = $1) s;
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

// PATCH an existing drug's stock count (a stock-take). It cannot go below what pending
// prescriptions have reserved.
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

    await inTransaction(res, 'updating drug stock', async (client) => {
        const drug = await lockDrug(client, drugId);
        if (!drug) return { status: 404, body: { error: 'Drug not found' } };
        if (count < drug.reserved_count) {
            return {
                status: 409,
                body: {
                    error: `${drug.reserved_count} are reserved by pending prescriptions. Dispense or cancel them first, or set at least ${drug.reserved_count}.`,
                    reserved_count: drug.reserved_count,
                },
            };
        }
        const { rows } = await client.query(
            `UPDATE pharmacy SET stock_count = $1, last_updated_at = NOW(), last_updated_by = $2
             WHERE id = $3 RETURNING *`,
            [count, last_updated_by, drugId]
        );
        return { status: 200, body: { ...rows[0], reserved_count: drug.reserved_count, available_count: count - drug.reserved_count } };
    });
});

// POST dispense without a prescription (e.g. a walk-in). Only stock not reserved by pending
// prescriptions can be used. The drug row is locked, so two devices dispensing at once both count.
router.post('/:drugId/dispense', authenticateToken, async (req, res) => {
    const quantity = toPositiveInt(req.body.quantity);
    if (!quantity) {
        return res.status(400).json({ error: 'quantity must be a positive integer' });
    }

    await inTransaction(res, 'dispensing drug', async (client) => {
        const drug = await lockDrug(client, req.params.drugId);
        if (!drug) return { status: 404, body: { error: 'Drug not found' } };
        if (drug.available_count < quantity) {
            return {
                status: 409,
                body: {
                    error: `Only ${Math.max(drug.available_count, 0)} available` +
                        (drug.reserved_count ? ` (${drug.reserved_count} reserved for prescriptions).` : '.') +
                        ' Another device may have used it.',
                    stock_count: drug.stock_count,
                    available_count: drug.available_count,
                },
            };
        }
        const { rows } = await client.query(
            `UPDATE pharmacy SET stock_count = stock_count - $1, last_updated_at = NOW(), last_updated_by = $2
             WHERE id = $3 RETURNING *`,
            [quantity, req.user.id, req.params.drugId]
        );
        return {
            status: 200,
            body: { ...rows[0], reserved_count: drug.reserved_count, available_count: rows[0].stock_count - drug.reserved_count },
        };
    });
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

    await inTransaction(res, 'deleting drug', async (client) => {
        const drug = await lockDrug(client, drugId);
        if (!drug) return { status: 404, body: { error: 'Drug not found' } };
        // Deleting it would silently drop the stock those prescriptions are waiting for.
        if (drug.reserved_count > 0) {
            return {
                status: 409,
                body: { error: `${drug.drug_name} has pending prescriptions. Dispense or cancel them before removing it.` },
            };
        }
        await client.query('DELETE FROM pharmacy WHERE id = $1', [drugId]);
        return { status: 204 };
    });
});


module.exports = router;
