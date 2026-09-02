// routes/registration.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');

// Patient/visit creation and updates live in routes/visits.js (POST /api/visits)
// and routes/patient.js (PUT /api/patient/:id). This router only handles
// deletion, which the patient list uses.

/**
 * DELETE /api/registration/:patientId
 * Removes the patient (cascades to vitals/hef/visits due to FK ON DELETE CASCADE)
 */
router.delete('/:patientId', authenticateToken, requireRole(['any']), async (req, res) => {
  try {
    const del = await db.query('DELETE FROM patients WHERE id = $1 RETURNING id', [ req.params.patientId ]);
    if (!del.rows.length) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient deleted', patient_id: del.rows[0].id });
  } catch (err) {
    console.error('Registration delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
