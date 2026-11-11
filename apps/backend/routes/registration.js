// routes/registration.js
// Deleting a patient (Delete on the Patient List). New patients and visits are registered with
// POST /api/visits (routes/visits.js).

const express = require('express');
const router = express.Router();
const { integerParams } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['patientId']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');
const { lockPatients, leaveFamily } = require('./family');

/**
 * DELETE /api/registration/:patientId
 * Removes the patient (cascades to vitals/hef/visits due to FK ON DELETE CASCADE)
 */
router.delete('/:patientId', authenticateToken, requireRole(['admin']), async (req, res) => {
  const patientId = Number(req.params.patientId);
  let client;
  try {
    client = await db.pool.connect();
  } catch (err) {
    console.error('Failed to acquire database connection:', err);
    return res.status(500).json({ message: 'Database connection unavailable' });
  }
  try {
    await client.query('BEGIN');
    const [patient] = await lockPatients(client, [patientId]);
    if (!patient) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Patient not found' });
    }
    // Their family must not be left with one member, or waiting for them at a station.
    await leaveFamily(client, patient, req.user.id);
    await client.query('DELETE FROM patients WHERE id = $1', [patientId]);
    await client.query('COMMIT');
    res.json({ message: 'Patient deleted', patient_id: patientId });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Registration delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
