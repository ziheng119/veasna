// routes/family.js
// Grouping patients into families (patients.family, see utils/family.js). Queue numbers are not
// changed. Anyone may do it: it is how registration staff group a family after registering each
// member. A family always has at least two members. Members waiting at the same station move on
// together (utils/familyMoves.js).
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { toPositiveInt } = require('../utils/validation');
const { nextFamilyLetters } = require('../utils/family');
const { lockFamilies, releasePatient } = require('../utils/familyMoves');

const PATIENT_NOT_FOUND = { status: 404, body: { error: 'Patient not found. They may have been deleted on another device.' } };

// Runs work(client) in a transaction; work returns { status, body } to send.
async function inTransaction(res, what, work) {
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
        await client.query(status < 400 ? 'COMMIT' : 'ROLLBACK');
        res.status(status).json(body);
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        console.error(`Error ${what}:`, err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
}

// Locks the patients (in id order, after the location's family lock) and returns them.
async function lockPatients(client, ids) {
    const { rows: first } = await client.query('SELECT location_id FROM patients WHERE id = $1', [ids[0]]);
    if (!first.length) return [];
    await lockFamilies(client, first[0].location_id);
    const { rows } = await client.query(
        'SELECT id, english_name, family, location_id FROM patients WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
        [ids]
    );
    return rows;
}

async function setFamily(client, patientId, family, userId) {
    await client.query(
        'UPDATE patients SET family = $2, last_updated_by = $3, last_updated_at = NOW() WHERE id = $1',
        [patientId, family, userId]
    );
}

// A family left with one member is no longer a family: that patient's letter is taken off, and the
// letter is free for the next family. Returns the remaining patients' ids, for releasePatient.
async function tidyFamily(client, locationId, family, userId) {
    const { rows } = await client.query(
        'SELECT id FROM patients WHERE location_id = $1 AND family = $2 ORDER BY id FOR UPDATE',
        [locationId, family]
    );
    if (rows.length === 1) await setFamily(client, rows[0].id, null, userId);
    return rows.map((row) => row.id);
}

// POST /api/family - Body: { patient_id, with_patient_id }
// Puts patient_id in with_patient_id's family, or, when that patient has none, starts a new family
// of the two with the first free letter at the location. A patient leaving another family for it
// leaves that family behind (dissolved if only one member is left). Both patients must belong to the
// same location. Returns { family, patients: [{ patient_id, family }] }.
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const patientId = toPositiveInt(req.body.patient_id);
    const withPatientId = toPositiveInt(req.body.with_patient_id);
    if (!patientId || !withPatientId) return res.status(400).json({ error: 'patient_id and with_patient_id must be positive integers' });
    if (patientId === withPatientId) return res.status(400).json({ error: 'Choose another patient to group with.' });

    await inTransaction(res, 'grouping a family', async (client) => {
        const rows = await lockPatients(client, [patientId, withPatientId]);
        const patient = rows.find((row) => row.id === patientId);
        const other = rows.find((row) => row.id === withPatientId);
        if (!patient || !other) return PATIENT_NOT_FOUND;
        if (patient.location_id !== other.location_id) {
            return { status: 400, body: { error: 'Both patients must belong to the same location.' } };
        }
        if (other.family && other.family === patient.family) {
            return { status: 200, body: { family: other.family, patients: [{ patient_id: patientId, family: other.family }, { patient_id: withPatientId, family: other.family }] } };
        }

        const userId = req.user.id;
        const old = patient.family;
        if (old) {
            await setFamily(client, patientId, null, userId);
        }
        let family = other.family;
        if (!family) {
            const { rows: used } = await client.query(
                'SELECT DISTINCT family FROM patients WHERE location_id = $1 AND family IS NOT NULL',
                [patient.location_id]
            );
            family = nextFamilyLetters(used.map((row) => row.family));
            await setFamily(client, withPatientId, family, userId);
        }
        await setFamily(client, patientId, family, userId);
        const leftBehind = old ? await tidyFamily(client, patient.location_id, old, userId) : [];

        // Whoever was waiting at a station for a member who changed family may now move on.
        for (const id of [patientId, withPatientId, ...leftBehind.slice(0, 1)]) await releasePatient(client, id, userId);
        return {
            status: 200,
            body: { family, patients: [{ patient_id: patientId, family }, { patient_id: withPatientId, family }] },
        };
    });
});

// POST /api/family/leave - Body: { patient_id }
// Takes the patient out of their family. A family left with one member is dissolved.
router.post('/leave', authenticateToken, requireRole(['any']), async (req, res) => {
    const patientId = toPositiveInt(req.body.patient_id);
    if (!patientId) return res.status(400).json({ error: 'patient_id must be a positive integer' });

    await inTransaction(res, 'leaving a family', async (client) => {
        const [patient] = await lockPatients(client, [patientId]);
        if (!patient) return PATIENT_NOT_FOUND;
        if (patient.family) {
            await setFamily(client, patientId, null, req.user.id);
            const leftBehind = await tidyFamily(client, patient.location_id, patient.family, req.user.id);
            for (const id of [patientId, ...leftBehind.slice(0, 1)]) await releasePatient(client, id, req.user.id);
        }
        return { status: 200, body: { patient_id: patientId, family: null } };
    });
});

module.exports = router;
