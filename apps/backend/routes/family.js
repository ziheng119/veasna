// routes/family.js
// Grouping patients into families (patients.family, see utils/family.js). Queue numbers are not
// changed. Registration staff group patients already in the queue by dragging their cards together
// (POST /group), or one at a time from the Patient List (POST /). A family always has at least two
// members. Members waiting at the same station move on together (utils/familyMoves.js).
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { toPositiveInt } = require('../utils/validation');
const { nextFamilyLetters } = require('../utils/family');
const { lockFamilies, releasePatient } = require('../utils/familyMoves');

const PATIENT_NOT_FOUND = { status: 404, body: { error: 'Patient not found. They may have been deleted on another device.' } };
// The most patients grouped at once.
const MAX_FAMILY_PICKS = 20;

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

// Locks the patients (in id order, after the family lock) and returns them.
async function lockPatients(client, ids) {
    await lockFamilies(client);
    const { rows } = await client.query(
        'SELECT id, english_name, family FROM patients WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
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
async function tidyFamily(client, family, userId) {
    const { rows } = await client.query(
        'SELECT id FROM patients WHERE family = $1 ORDER BY id FOR UPDATE',
        [family]
    );
    if (rows.length === 1) await setFamily(client, rows[0].id, null, userId);
    return rows.map((row) => row.id);
}

// Takes the patient out of their family (a family left with one member is dissolved) and lets whoever
// was waiting for them move on. The caller holds lockPatients.
async function leaveFamily(client, patient, userId) {
    if (!patient.family) return;
    await setFamily(client, patient.id, null, userId);
    const leftBehind = await tidyFamily(client, patient.family, userId);
    for (const id of [patient.id, ...leftBehind.slice(0, 1)]) await releasePatient(client, id, userId);
}

// Puts patientId in one family with withIds, the patients they came with: the family some of those
// are already in, or a new one with the first free letter. Those patients may be in at most one
// family between them. A patient leaving another family for it leaves that family behind (dissolved
// if only one member is left), and whoever waited at a station for a changed member may move on.
// Runs in the caller's transaction. Returns { family, patient_ids } or { status, error }.
async function joinFamilyOf(client, patientId, withIds, userId) {
    const rows = await lockPatients(client, [patientId, ...withIds]);
    const patient = rows.find((row) => row.id === patientId);
    const others = withIds.map((id) => rows.find((row) => row.id === id));
    if (!patient || others.some((other) => !other)) return { status: 404, error: PATIENT_NOT_FOUND.body.error };

    const families = [...new Set(others.map((other) => other.family).filter(Boolean))];
    if (families.length > 1) {
        return {
            status: 400,
            error: `Those patients are in different families (${families.join(', ')}). Pick the members of one family, and anyone not in a family yet.`,
        };
    }
    const patientIds = [patientId, ...withIds];
    let family = families[0] ?? null;
    if (family && [patient, ...others].every((member) => member.family === family)) {
        return { family, patient_ids: patientIds };
    }

    const old = patient.family && patient.family !== family ? patient.family : null;
    if (old) await setFamily(client, patientId, null, userId);
    if (!family) {
        const { rows: used } = await client.query('SELECT DISTINCT family FROM patients WHERE family IS NOT NULL');
        family = nextFamilyLetters(used.map((row) => row.family));
    }
    const changed = [];
    for (const member of [patient, ...others]) {
        if (member.family === family) continue;
        await setFamily(client, member.id, family, userId);
        changed.push(member.id);
    }
    const leftBehind = old ? await tidyFamily(client, old, userId) : [];
    for (const id of [...changed, ...leftBehind.slice(0, 1)]) await releasePatient(client, id, userId);
    return { family, patient_ids: patientIds };
}

// Makes patientIds exactly one family: the family most of them are in already (on a tie, the first
// such patient's), or a new one with the first free letter. Members of other families leave those
// behind (a family left with one member is dissolved), and whoever waited at a station for a changed
// member may move on. Runs in the caller's transaction. Returns { family, patient_ids } or
// { status, error }.
async function groupFamily(client, patientIds, userId) {
    const rows = await lockPatients(client, patientIds);
    const members = patientIds.map((id) => rows.find((row) => row.id === id));
    if (members.some((member) => !member)) return { status: 404, error: PATIENT_NOT_FOUND.body.error };

    const counts = new Map();
    for (const { family } of members) if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
    let family = null;
    for (const [letters, count] of counts) if (!family || count > counts.get(family)) family = letters;
    if (!family) {
        const { rows: used } = await client.query('SELECT DISTINCT family FROM patients WHERE family IS NOT NULL');
        family = nextFamilyLetters(used.map((row) => row.family));
    }

    const changed = [];
    const oldFamilies = new Set();
    for (const member of members) {
        if (member.family === family) continue;
        if (member.family) oldFamilies.add(member.family);
        await setFamily(client, member.id, family, userId);
        changed.push(member.id);
    }
    const released = [...changed];
    for (const old of oldFamilies) released.push(...(await tidyFamily(client, old, userId)).slice(0, 1));
    for (const id of released) await releasePatient(client, id, userId);
    return { family, patient_ids: patientIds };
}

// POST /api/family/group - Body: { patient_ids: [ids] } (2 to MAX_FAMILY_PICKS)
// Puts the patients in one family (groupFamily). Returns { family, patients: [{ patient_id, family }] }.
router.post('/group', authenticateToken, requireRole(['any']), async (req, res) => {
    const ids = Array.isArray(req.body.patient_ids) ? [...new Set(req.body.patient_ids.map(toPositiveInt))] : null;
    if (!ids || ids.some((id) => !id) || ids.length < 2 || ids.length > MAX_FAMILY_PICKS) {
        return res.status(400).json({ error: `patient_ids must list 2 to ${MAX_FAMILY_PICKS} different patient ids.` });
    }

    await inTransaction(res, 'grouping a family', async (client) => {
        const result = await groupFamily(client, ids, req.user.id);
        if (result.error) return { status: result.status, body: { error: result.error } };
        return {
            status: 200,
            body: { family: result.family, patients: result.patient_ids.map((id) => ({ patient_id: id, family: result.family })) },
        };
    });
});

// POST /api/family - Body: { patient_id, with_patient_id }
// Puts patient_id in with_patient_id's family, or, when that patient has none, starts a new family
// of the two (joinFamilyOf). Returns { family, patients: [{ patient_id, family }] }.
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const patientId = toPositiveInt(req.body.patient_id);
    const withPatientId = toPositiveInt(req.body.with_patient_id);
    if (!patientId || !withPatientId) return res.status(400).json({ error: 'patient_id and with_patient_id must be positive integers' });
    if (patientId === withPatientId) return res.status(400).json({ error: 'Choose another patient to group with.' });

    await inTransaction(res, 'grouping a family', async (client) => {
        const result = await joinFamilyOf(client, patientId, [withPatientId], req.user.id);
        if (result.error) return { status: result.status, body: { error: result.error } };
        return {
            status: 200,
            body: { family: result.family, patients: result.patient_ids.map((id) => ({ patient_id: id, family: result.family })) },
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
        await leaveFamily(client, patient, req.user.id);
        return { status: 200, body: { patient_id: patientId, family: null } };
    });
});

module.exports = router;
module.exports.lockPatients = lockPatients;
module.exports.leaveFamily = leaveFamily;
module.exports.joinFamilyOf = joinFamilyOf;
module.exports.groupFamily = groupFamily;
module.exports.MAX_FAMILY_PICKS = MAX_FAMILY_PICKS;
