// routes/registration.js

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');

/**
 * POST /api/registration
 * Creates patient + (optional) vitals + (optional) hef + (optional) visit/queue
 * Body:
 * {
 *   "patient": { english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id },
 *   "vitals": { height_cm, weight_kg, bmi, blood_pressure, temperature_c, vitals_notes },        // optional
 *   "hef": { know_hef, have_hef, hef_notes },                                                    // optional
 *   "visit": { location_id, visit_date, queue_no }                                               // optional (creates queue)
 * }
 */
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
  const { patient, vitals, hef, visit } = req.body;
  if (!patient || !patient.english_name || !patient.location_id) {
    return res.status(400).json({ message: 'patient.english_name and patient.location_id are required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const pRes = await client.query(
      `INSERT INTO patients(english_name, khmer_name, date_of_birth, sex, phone_number, address, location_id)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        patient.english_name, patient.khmer_name || null, patient.date_of_birth || null,
        patient.sex || null, patient.phone_number || null, patient.address || null,
        patient.location_id
      ]
    );
    const newPatient = pRes.rows[0];

    let vitalsRow = null;
    if (vitals) {
      const vRes = await client.query(
        `INSERT INTO vitals(patient_id, height_cm, weight_kg, bmi, blood_pressure, temperature_c, vitals_notes)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          newPatient.id, vitals.height_cm || null, vitals.weight_kg || null, vitals.bmi || null,
          vitals.blood_pressure || null, vitals.temperature_c || null, vitals.vitals_notes || null
        ]
      );
      vitalsRow = vRes.rows[0];
    }

    let hefRow = null;
    if (hef) {
      const hRes = await client.query(
        `INSERT INTO hef(patient_id, know_hef, have_hef, hef_notes)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [ newPatient.id, !!hef.know_hef, !!hef.have_hef, hef.hef_notes || null ]
      );
      hefRow = hRes.rows[0];
    }

    let visitRow = null;
    if (visit && visit.location_id) {
      const visitDate = visit.visit_date || new Date().toISOString().slice(0,10);
      if (!visit.queue_no || !String(visit.queue_no).trim()) {
        return res.status(400).json({ message: 'visit.queue_no is required (e.g., "2A", "3")' });
      }
      const queueToken = String(visit.queue_no).trim().toUpperCase();
      const insV = await client.query(
        `INSERT INTO visits(patient_id, location_id, visit_date, queue_no)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [ newPatient.id, visit.location_id, visitDate, queueToken ]
      );
      visitRow = insV.rows[0];

      // Mirror on patient for quick lookup
      await client.query(
        `UPDATE patients SET queue_no = $1 WHERE id = $2`,
        [ queueToken, newPatient.id ]
      );
      // Ensure the response also shows the mirrored queue number
      newPatient.queue_no = queueToken;
    }

    await client.query('COMMIT');
    res.status(201).json({ patient: newPatient, vitals: vitalsRow, hef: hefRow, visit: visitRow });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err && err.code === '23505') {
      return res.status(409).json({ message: 'Duplicate queue number for this location and date' });
    }
    console.error('Registration create error:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/registration/:patientId
 * Updates patient fields; optionally appends a new vitals/hef record.
 * (Vitals/HEF are append-only for audit.)
 */
router.put('/:patientId', authenticateToken, requireRole(['any']), async (req, res) => {
  const { patient, vitals, hef, visit } = req.body;
  const { patientId } = req.params;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let updatedPatient = null;
    if (patient) {
      const uRes = await client.query(
        `UPDATE patients
            SET english_name = COALESCE($1, english_name),
                khmer_name   = COALESCE($2, khmer_name),
                date_of_birth= COALESCE($3, date_of_birth),
                sex          = COALESCE($4, sex),
                phone_number = COALESCE($5, phone_number),
                address      = COALESCE($6, address),
                location_id  = COALESCE($7, location_id)
          WHERE id = $8
        RETURNING *`,
        [
          patient.english_name || null, patient.khmer_name || null, patient.date_of_birth || null,
          patient.sex || null, patient.phone_number || null, patient.address || null,
          patient.location_id || null, patientId
        ]
      );
      if (!uRes.rows.length) return res.status(404).json({ message: 'Patient not found' });
      updatedPatient = uRes.rows[0];
    }

    let vitalsRow = null;
    if (vitals) {
      const vRes = await client.query(
        `INSERT INTO vitals(patient_id, height_cm, weight_kg, bmi, blood_pressure, temperature_c, vitals_notes)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          patientId, vitals.height_cm || null, vitals.weight_kg || null, vitals.bmi || null,
          vitals.blood_pressure || null, vitals.temperature_c || null, vitals.vitals_notes || null
        ]
      );
      vitalsRow = vRes.rows[0];
    }

    let hefRow = null;
    if (hef) {
      const hRes = await client.query(
        `INSERT INTO hef(patient_id, know_hef, have_hef, hef_notes)
         VALUES($1,$2,$3,$4) RETURNING *`,
        [ patientId, !!hef.know_hef, !!hef.have_hef, hef.hef_notes || null ]
      );
      hefRow = hRes.rows[0];
    }

    // Optionally update/create visit & mirror queue on patient
    let visitRow = null;
    if (visit && visit.location_id) {
      const visitDate = visit.visit_date || new Date().toISOString().slice(0,10);
      if (!visit.queue_no || !String(visit.queue_no).trim()) {
        return res.status(400).json({ message: 'visit.queue_no is required when visit is provided' });
      }
      const queueToken = String(visit.queue_no).trim().toUpperCase();

      // Try to find an existing visit for this patient/location/date
      const existing = await client.query(
        `SELECT id FROM visits WHERE patient_id = $1 AND location_id = $2 AND visit_date = $3`,
        [ patientId, visit.location_id, visitDate ]
      );

      if (existing.rows.length) {
        const upd = await client.query(
          `UPDATE visits SET queue_no = $1 WHERE id = $2 RETURNING *`,
          [ queueToken, existing.rows[0].id ]
        );
        visitRow = upd.rows[0];
      } else {
        const ins = await client.query(
          `INSERT INTO visits(patient_id, location_id, visit_date, queue_no)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [ patientId, visit.location_id, visitDate, queueToken ]
        );
        visitRow = ins.rows[0];
      }

      // Mirror on patient
      await client.query(`UPDATE patients SET queue_no = $1 WHERE id = $2`, [ queueToken, patientId ]);
      if (updatedPatient) updatedPatient.queue_no = queueToken;
    }

    await client.query('COMMIT');
    res.json({ patient: updatedPatient, vitals: vitalsRow, hef: hefRow, visit: visitRow });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err && err.code === '23505') {
      return res.status(409).json({ message: 'Duplicate queue number for this location and date' });
    }
    console.error('Registration update error:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

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
