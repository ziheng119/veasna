// routes/api.js

const express = require('express');
const router = express.Router();
const { integerParams } = require('../utils/validation');
// Non-integer IDs in the URL are rejected with 400 before reaching the database.
integerParams(router, ['id']);
const { authorizeApi } = require('../middleware/authorizeApi');
router.use(authorizeApi);

const sessionRoutes = require('./session');
const patientRoutes = require('./patient');
const patientsRoutes = require('./patients');
const locationRoutes = require('./locations');
const registrationRoutes = require('./registration');
const queueRoutes = require('./queue');
const visitRoutes = require('./visits');
const visitEditRoutes = require('./visitEdits');
const pharmacyRoutes = require('./pharmacy');
const triageRoutes = require('./triage');
const tbRoutes = require('./tb');
const analyticsRoutes = require('./analytics');

router.use('/auth', sessionRoutes);
router.use('/locations', locationRoutes);
router.use('/registration', registrationRoutes);
router.use('/queue', queueRoutes);
router.use('/visits', visitRoutes);
// Admin-only corrections to saved visits (details, vitals/HEF, TB record).
router.use('/visits', visitEditRoutes);
router.use('/pharmacy', pharmacyRoutes);
router.use('/triage', triageRoutes);
router.use('/tb', tbRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/patient', patientRoutes);

const { body, query } = require('express-validator');

const db = require('../config/db');
const { authenticateToken, requireRole, validateRequest } = require('./auth');
const { normalizeSexToEnum } = require('../utils/sex');

// --- User Management (any authenticated user) ---

// GET all users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT username
       FROM users
       WHERE is_active = TRUE
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fixed accounts cannot be created or reactivated through legacy APIs.
router.post('/users', authenticateToken, (_req, res) => res.status(403).json({ message: 'Account creation is disabled.' }));

// PATCH /users/deactivate
router.patch(
  '/users/deactivate',
  authenticateToken,
  requireRole(['admin']),
  [
    body('username')
      .isLength({ min: 2 })
      .withMessage('Username must be at least 2 characters'),
  ],
  validateRequest,
  async (req, res) => {
    const { username } = req.body;
    const values = [username]; // Parameters array

    // Define SQL queries as constants
    const SELECT_USER = `
      SELECT id, username, is_active
      FROM users
      WHERE LOWER(username) = LOWER($1)
    `;

    const DEACTIVATE_USER = `
      UPDATE users
      SET is_active = FALSE,
          last_updated_at = NOW()
      WHERE LOWER(username) = LOWER($1)
      RETURNING id, username, is_active, created_at, last_updated_at
    `;

    try {
      // 1️⃣ Check if user exists
      const { rows: users } = await db.query(SELECT_USER, values);

      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = users[0];

      if (!user.is_active) {
        // 2️⃣ User already inactive
        return res.status(200).json({
          message: 'User already inactive',
          user,
        });
      }

      // 3️⃣ Deactivate user
      const { rows } = await db.query(DEACTIVATE_USER, values);

      return res.status(200).json({
        message: 'User successfully deactivated',
        user: rows[0],
      });
    } catch (error) {
      console.error('Deactivate User Error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// -- Location Management --
router.get(
  '/locations',
  authenticateToken,
  async (req, res) => {
    try {
      const query = `
        SELECT name
        FROM locations
        WHERE is_active = TRUE
        ORDER BY name ASC;
      `;

      const { rows } = await db.query(query);
      res.json(rows);
    } catch (error) {
      console.error('Get Locations Error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// --- Patient Management ---

// POST create a new patient
router.post(
  '/patients',
  authenticateToken,
  [
    body('face_id').notEmpty().withMessage('Face ID is required'),
    body('location_id').notEmpty().isInt({ min: 1 }).withMessage('Valid location_id is required'),
    body('date_of_birth').notEmpty().isISO8601().withMessage('Valid date of birth is required'),
    body('sex')
      .notEmpty()
      .withMessage('Sex is required')
      .custom((value) => normalizeSexToEnum(value) !== null)
      .withMessage('Valid sex is required (M/F)'),
    body('user_id').notEmpty().isInt({ min: 1 }).withMessage('Valid user ID is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const {
        face_id,
        location_id,
        english_name,
        khmer_name,
        date_of_birth,
        sex,
        address,
        phone_number,
        user_id,
      } = req.body;
      const normalizedSex = normalizeSexToEnum(sex);

      const query = `
        INSERT INTO patients (
          face_id,
          location_id,
          english_name,
          khmer_name,
          date_of_birth,
          sex,
          address,
          phone_number,
          last_updated_by,
          last_updated_at,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
        RETURNING *;
      `;

      const values = [
        face_id,
        location_id,
        english_name || null,
        khmer_name || null,
        date_of_birth || null,
        normalizedSex,
        address || null,
        phone_number || null,
        user_id,
      ];

      const { rows } = await db.query(query, values);
      res.status(201).json({
        message: 'Patient created successfully',
        patient: rows[0],
      });
    } catch (error) {
      console.error('Create Patient Error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);


// GET: today's patients (by location_id and visit_date)
router.get(
  '/patients/today',
  authenticateToken,
  [
    query('location_id')
      .notEmpty().isInt({ min: 1 }).withMessage('Valid location_id is required'),
    query('visit_date')
      .optional() // if not provided, default to today
      .isISO8601().withMessage('Valid visit_date is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const location_id = Number(req.query.location_id);
      const visit_date = req.query.visit_date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const sql = `
        SELECT
          p.face_id,
          p.english_name,
          p.khmer_name,
          p.date_of_birth,
          p.sex,
          p.address,
          p.phone_number,
          v.queue_no
        FROM patients p
        JOIN visits v ON v.patient_id = p.id
        WHERE p.location_id = $1
          AND v.visit_date = $2
        ORDER BY v.queue_no ASC;
      `;

      const result = await db.query(sql, [location_id, visit_date]);

      res.json({
        message: 'Patients fetched successfully',
        visit_date,
        patients: result.rows,
      });
    } catch (error) {
      console.error('Get Today Patients Error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// Delete patient
router.delete('/patients/:id', [authenticateToken, requireRole(['admin'])], async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM patients WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient deleted successfully', patient_id: rows[0].id });
  } catch (error) {
    console.error('Delete Patient Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Legacy vitals/HEF routes removed — use visit-based routes in /api/visits instead

// --- Visual Acuity Management ---

// Add visual acuity for a patient
router.post('/patients/:id/visual_acuity', [
  authenticateToken,
  requireRole(['any']),
  body('left_pin').notEmpty().withMessage('Left pin is required'),
  body('right_pin').notEmpty().withMessage('Right pin is required'),
  body('left_no_pin').notEmpty().withMessage('Left no-pin is required'),
  body('right_no_pin').notEmpty().withMessage('Right no-pin is required'),
], validateRequest, async (req, res) => {
  try {
    const { left_pin, left_no_pin, right_pin, right_no_pin, visual_notes } = req.body;
    const query = `
      INSERT INTO visual_acuity(patient_id, left_pin, left_no_pin, right_pin, right_no_pin, visual_notes)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *;
    `;
    const values = [req.params.id, left_pin, left_no_pin, right_pin, right_no_pin, visual_notes];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Visual Acuity Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get visual acuity records for a patient
router.get('/patients/:id/visual_acuity', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM visual_acuity WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Visual Acuity Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Presenting Complaint Management ---

// Add presenting complaint
router.post('/patients/:id/presenting_complaint', [
  authenticateToken,
  requireRole(['any']),
  body('history').notEmpty().withMessage('History is required')
], validateRequest, async (req, res) => {
  try {
    const { history, red_flags, systems_review, drug_allergies } = req.body;
    const query = `
      INSERT INTO presenting_complaint(patient_id, history, red_flags, systems_review, drug_allergies)
      VALUES($1,$2,$3,$4,$5) RETURNING *;
    `;
    const values = [req.params.id, history, red_flags, systems_review, drug_allergies];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Presenting Complaint Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get presenting complaints for a patient
router.get('/patients/:id/presenting_complaint', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM presenting_complaint WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Presenting Complaint Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- History Management ---

// Add history record
router.post('/patients/:id/history', [
  authenticateToken,
  requireRole(['any']),
  body('past').notEmpty().withMessage('Past history is required')
], validateRequest, async (req, res) => {
  try {
    const { past, drug_and_treatment, family, social, systems_review } = req.body;
    const query = `
      INSERT INTO history(patient_id, past, drug_and_treatment, family, social, systems_review)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *;
    `;
    const values = [req.params.id, past, drug_and_treatment, family, social, systems_review];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add History Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get history records for a patient
router.get('/patients/:id/history', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM history WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get History Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Consultation Management ---

// Create a consultation
router.post('/patients/:id/consultations', [
  authenticateToken,  
  requireRole(['any']),
  body('consultation_notes').notEmpty().withMessage('Consultation notes are required')
], validateRequest, async (req, res) => {
  try {
    const { consultation_notes, prescription } = req.body;
    const query = `
      INSERT INTO consultation(patient_id, doctor_id, consultation_notes, prescription)
      VALUES($1,$2,$3,$4) RETURNING *;
    `;
    const values = [req.params.id, req.user.id, consultation_notes, prescription];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create Consultation Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get consultations for a patient
router.get('/patients/:id/consultations', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM consultation WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Consultations Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Referral Management ---

// Add a referral for a consultation
router.post('/consultations/:id/referrals', [
  authenticateToken,
  requireRole(['any']),
  body('referral_type').isIn([    'MongKol Borey Hospital', 'Optometrist', 'Dentist','Poipet Referral Hospital','Bong Bondol','SEVA','WSAudiology' ]).withMessage('Invalid referral type')
], validateRequest, async (req, res) => {
  try {
    const { referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type } = req.body;
    const query = `
      INSERT INTO referral(patient_id, doctor_id, consultation_id, referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;
    `;
    // fetch consultation to get patient_id
    const cons = await db.query('SELECT patient_id FROM consultation WHERE id=$1',[req.params.id]);
    if(!cons.rows.length) return res.status(404).json({message:'Consultation not found'});
    const patient_id = cons.rows[0].patient_id;
    const values = [patient_id, req.user.id, req.params.id, referral_date, referral_symptom, referral_symptom_duration, referral_reason, referral_type];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Referral Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get referrals for a consultation
router.get('/consultations/:id/referrals', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM referral WHERE consultation_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Referrals Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// --- Physiotherapy Management ---

// Add physiotherapy for a patient
router.post('/patients/:id/physiotherapy', [
  authenticateToken,
  requireRole(['any']),
  body('pain_areas_description').notEmpty().withMessage('Pain areas description is required')
], validateRequest, async (req, res) => {
  try {
    const { pain_areas_description } = req.body;
    const query = `INSERT INTO physiotherapy(patient_id, doctor_id, pain_areas_description)
      VALUES($1,$2,$3) RETURNING *;`;
    const values = [req.params.id, req.user.id, pain_areas_description];
    const { rows } = await db.query(query, values);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Add Physiotherapy Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get physiotherapy records for a patient
router.get('/patients/:id/physiotherapy', [authenticateToken, requireRole(['any'])], async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM physiotherapy WHERE patient_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (error) {
    console.error('Get Physiotherapy Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mount /patients subrouter after inline /patients routes to avoid conflicts
router.use('/patients', patientsRoutes);

module.exports = router;
