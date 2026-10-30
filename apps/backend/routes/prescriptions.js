// routes/prescriptions.js
// Prescriptions linked to pharmacy inventory.
//   Prescribing reserves the quantity at once, so available stock goes down before dispensing.
//   Dispensing (pharmacy) takes it off stock_count; cancelling releases the reservation.
// Reserved stock is never stored separately: it is the sum of pending prescriptions per drug
// (see utils/pharmacyStock.js), so it cannot drift from the prescriptions themselves.
const express = require('express');
const router = express.Router();
const { integerParams, toPositiveInt } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['prescriptionId', 'patientId']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { ensurePrescriptions } = require('../utils/ensureSchema');
const { lockDrug } = require('../utils/pharmacyStock');
const { textOrEmpty } = require('../utils/partialFields');

const STATUSES = ['pending', 'dispensed', 'cancelled'];
const MAX_INSTRUCTIONS = 500;

router.use(async (req, res, next) => {
    try {
        await ensurePrescriptions();
        next();
    } catch (err) {
        console.error('Prescriptions schema migration failed:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Every listing returns the same shape: the prescription, who acted on it, and the patient/visit.
const SELECT_PRESCRIPTIONS = `
    SELECT pr.id, pr.visit_id, pr.drug_id, pr.drug_name, pr.quantity, pr.instructions, pr.status,
           pr.prescribed_at, pu.username AS prescribed_by,
           pr.dispensed_at, du.username AS dispensed_by,
           pr.cancelled_at, cu.username AS cancelled_by,
           v.patient_id, v.queue_no, TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, v.location_id,
           pa.english_name, pa.khmer_name
    FROM prescriptions pr
    JOIN visits v ON v.id = pr.visit_id
    JOIN patients pa ON pa.id = v.patient_id
    LEFT JOIN users pu ON pu.id = pr.prescribed_by
    LEFT JOIN users du ON du.id = pr.dispensed_by
    LEFT JOIN users cu ON cu.id = pr.cancelled_by`;

async function fetchPrescription(client, id) {
    const { rows } = await client.query(`${SELECT_PRESCRIPTIONS} WHERE pr.id = $1`, [id]);
    return rows[0] || null;
}

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
        res.status(status).json(body);
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error(`Error ${label}:`, err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        client.release();
    }
}

// GET /api/prescriptions?visit_id=...                     one visit's prescriptions
// GET /api/prescriptions?location_id=...[&status=pending]  a location's prescriptions (pharmacy)
router.get('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = req.query.visit_id === undefined ? null : toPositiveInt(req.query.visit_id);
    const locationId = req.query.location_id === undefined ? null : toPositiveInt(req.query.location_id);
    const status = req.query.status || null;

    if (!visitId && !locationId) {
        return res.status(400).json({ error: 'visit_id or location_id must be a positive integer' });
    }
    if (status && !STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
    }

    try {
        const { rows } = await db.query(
            `${SELECT_PRESCRIPTIONS}
             WHERE ($1::int IS NULL OR pr.visit_id = $1)
               AND ($2::int IS NULL OR v.location_id = $2)
               AND ($3::text IS NULL OR pr.status = $3)
             ORDER BY pr.prescribed_at ASC, pr.id ASC`,
            [visitId, locationId, status]
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching prescriptions:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/prescriptions/patients?location_id=... - patients with prescriptions at the location,
// with counts by status and the date they were last prescribed something.
router.get('/patients', authenticateToken, requireRole(['any']), async (req, res) => {
    const locationId = toPositiveInt(req.query.location_id);
    if (!locationId) {
        return res.status(400).json({ error: 'location_id must be a positive integer' });
    }

    try {
        const { rows } = await db.query(
            `SELECT pa.id AS patient_id, pa.english_name, pa.khmer_name, pa.face_id,
                    COUNT(*) FILTER (WHERE pr.status = 'pending')::int AS pending_count,
                    COUNT(*) FILTER (WHERE pr.status = 'dispensed')::int AS dispensed_count,
                    COUNT(*) FILTER (WHERE pr.status = 'cancelled')::int AS cancelled_count,
                    MAX(pr.prescribed_at) AS last_prescribed_at
             FROM prescriptions pr
             JOIN visits v ON v.id = pr.visit_id
             JOIN patients pa ON pa.id = v.patient_id
             WHERE v.location_id = $1
             GROUP BY pa.id
             ORDER BY MAX(pr.prescribed_at) DESC`,
            [locationId]
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching prescription patients:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/prescriptions/patient/:patientId - everything the patient was prescribed, newest first
router.get('/patient/:patientId', authenticateToken, requireRole(['any']), async (req, res) => {
    try {
        const { rows } = await db.query(
            `${SELECT_PRESCRIPTIONS} WHERE v.patient_id = $1 ORDER BY pr.prescribed_at DESC, pr.id DESC`,
            [req.params.patientId]
        );
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching patient prescriptions:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/prescriptions - Body: { visit_id, drug_id, quantity, instructions? }
// Reserves the quantity straight away. Refused (409) when more than the available stock is asked for.
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const visitId = toPositiveInt(req.body.visit_id);
    const drugId = toPositiveInt(req.body.drug_id);
    const quantity = toPositiveInt(req.body.quantity);
    const instructions = textOrEmpty(req.body.instructions).trim();

    if (!visitId || !drugId) {
        return res.status(400).json({ error: 'visit_id and drug_id must be positive integers' });
    }
    if (!quantity) {
        return res.status(400).json({ error: 'quantity must be a positive whole number' });
    }
    if (instructions.length > MAX_INSTRUCTIONS) {
        return res.status(400).json({ error: `instructions must be at most ${MAX_INSTRUCTIONS} characters` });
    }

    await inTransaction(res, 'creating prescription', async (client) => {
        const visit = await client.query('SELECT id, location_id FROM visits WHERE id = $1', [visitId]);
        if (!visit.rows.length) {
            return { status: 404, body: { error: 'Visit not found. It may have been deleted on another device.' } };
        }
        const drug = await lockDrug(client, drugId);
        if (!drug) return { status: 404, body: { error: 'Drug not found. Refresh the drug list.' } };
        if (drug.location_id !== visit.rows[0].location_id) {
            return { status: 400, body: { error: "That drug is not in this location's pharmacy." } };
        }
        if (quantity > drug.available_count) {
            return {
                status: 409,
                body: {
                    error: `Only ${Math.max(drug.available_count, 0)} ${drug.drug_name} available. Lower the quantity or choose another drug.`,
                    available_count: drug.available_count,
                },
            };
        }

        const { rows } = await client.query(
            `INSERT INTO prescriptions (visit_id, drug_id, drug_name, quantity, instructions, prescribed_by, last_updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
            [visitId, drugId, drug.drug_name, quantity, instructions, req.user.id]
        );
        const prescription = await fetchPrescription(client, rows[0].id);
        return { status: 201, body: { ...prescription, available_count: drug.available_count - quantity } };
    });
});

// Locks a pending prescription and its drug for dispensing or cancelling.
async function lockPending(client, prescriptionId) {
    const { rows } = await client.query('SELECT * FROM prescriptions WHERE id = $1 FOR UPDATE', [prescriptionId]);
    if (!rows.length) return { error: { status: 404, body: { error: 'Prescription not found' } } };
    const prescription = rows[0];
    if (prescription.status !== 'pending') {
        return { error: { status: 409, body: { error: `This prescription has already been ${prescription.status}. Refresh the list.` } } };
    }
    const drug = prescription.drug_id ? await lockDrug(client, prescription.drug_id) : null;
    return { prescription, drug };
}

// POST /api/prescriptions/:prescriptionId/dispense - hand the drug over: stock_count goes down by
// the quantity, which releases the reservation at the same time.
router.post('/:prescriptionId/dispense', authenticateToken, requireRole(['any']), async (req, res) => {
    await inTransaction(res, 'dispensing prescription', async (client) => {
        const { prescription, drug, error } = await lockPending(client, req.params.prescriptionId);
        if (error) return error;
        if (!drug) {
            return { status: 409, body: { error: 'This drug was removed from the pharmacy. Cancel the prescription instead.' } };
        }
        // Reserved stock is always on the shelf (stock-takes cannot go below it), so this holds.
        if (drug.stock_count < prescription.quantity) {
            return { status: 409, body: { error: `Only ${drug.stock_count} ${drug.drug_name} in stock.` } };
        }
        await client.query(
            `UPDATE pharmacy SET stock_count = stock_count - $1, last_updated_at = NOW(), last_updated_by = $2 WHERE id = $3`,
            [prescription.quantity, req.user.id, drug.id]
        );
        await client.query(
            `UPDATE prescriptions SET status = 'dispensed', dispensed_by = $2, dispensed_at = NOW(),
                    last_updated_by = $2, last_updated_at = NOW()
             WHERE id = $1`,
            [prescription.id, req.user.id]
        );
        return { status: 200, body: await fetchPrescription(client, prescription.id) };
    });
});

// POST /api/prescriptions/:prescriptionId/cancel - release the reserved stock.
router.post('/:prescriptionId/cancel', authenticateToken, requireRole(['any']), async (req, res) => {
    await inTransaction(res, 'cancelling prescription', async (client) => {
        const { prescription, error } = await lockPending(client, req.params.prescriptionId);
        if (error) return error;
        await client.query(
            `UPDATE prescriptions SET status = 'cancelled', cancelled_by = $2, cancelled_at = NOW(),
                    last_updated_by = $2, last_updated_at = NOW()
             WHERE id = $1`,
            [prescription.id, req.user.id]
        );
        return { status: 200, body: await fetchPrescription(client, prescription.id) };
    });
});

module.exports = router;
