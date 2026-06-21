// routes/visits.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');

// POST /api/visits (Create a new patient visit)
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const last_updated_by = req.user.id;
    const { patientInfo, visit, vitals, hef } = req.body;


    try {
        await db.query('BEGIN');

        // Step 1: Insert or Find the patient
        let patientId = patientInfo.id;
        if (!patientId) {
            // New patient: Insert into patients table
            const patientQuery = `
                INSERT INTO patients (face_id, location_id, english_name, khmer_name, date_of_birth, sex, address, phone_number, last_updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id;
            `;
            const patientValues = [
                patientInfo.face_id,
                patientInfo.location_id,
                patientInfo.english_name,
                patientInfo.khmer_name,
                patientInfo.date_of_birth || null,
                patientInfo.sex,
                patientInfo.address,
                patientInfo.phone_number,
                last_updated_by
            ];
            const patientResult = await db.query(patientQuery, patientValues);
            patientId = patientResult.rows[0].id
        }

        // Step 2: Insert into visits table
        const visitQuery = `
            INSERT INTO visits (patient_id, location_id, queue_no, visit_date, last_updated_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, created_at;
        `;
        const visitValues = [
            patientId, 
            patientInfo.location_id, 
            visit.queue_no, 
            new Date(), 
            last_updated_by
        ];
        const visitResult = await db.query(visitQuery, visitValues);
        const visitId = visitResult.rows[0].id;
        const visitTimestamp = visitResult.rows[0].created_at;

        // Step 3: Insert into vitals table
        const vitalsQuery = `
            INSERT INTO vitals (visit_id, height, weight, bmi, below_3rd_percentile, bp_systolic, bp_diastolic, temperature, notes, last_updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `;
        const vitalsValues = [
            visitId, 
            parseFloat(vitals.height), 
            parseFloat(vitals.weight), 
            parseFloat(vitals.bmi),
            vitals.below_3rd_percentile,
            parseInt(vitals.bp_systolic),
            parseInt(vitals.bp_diastolic),
            parseFloat(vitals.temperature),
            vitals.notes,
            last_updated_by
        ];
        await db.query(vitalsQuery, vitalsValues);

        // Step 4: Insert into HEF table
        const hefQuery = `
            INSERT INTO hef (visit_id, know_of_hef, has_hef, notes, last_updated_by)
            VALUES ($1, $2, $3, $4, $5);
        `;

        const hefValues = [
            visitId, 
            hef.know_of_hef === 'yes', 
            hef.has_hef === 'yes', 
            hef.notes, 
            last_updated_by
        ];
        await db.query(hefQuery, hefValues);

        // if all queries succeed, commit the transaction
        await db.query('COMMIT');

        // respond with the newly created QueuedPatient Object
        res.status(201).json({
            visit_id: visitId,
            patient_id: patientId,
            queue_no: visit.queue_no,
            english_name: patientInfo.english_name,
            khmer_name: patientInfo.khmer_name,
            age: patientInfo.age,
            sex: patientInfo.sex,
            timestamp: new Date(visitTimestamp).toLocaleTimeString()
        });

    } catch (err) {
        // if any query fails, roll back entire transaction
        await db.query('ROLLBACK');
        console.error('Error in registration transaction:', err);
        res.status(500).json({ error: 'Failed to register patient' });
    // } finally {
    //     // Release the db back to the pool
    //     db.release();
    }
});

// === SHARED ACROSS SEVA, PHYSIO, DOC CONSULT ===

// GET: vitals
router.get('/vitals/:id/:visit_id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id } = req.params;
  const { visit_id } = req.params;

  if (!id || !visit_id) {
    return res.status(400).json({ error: 'Patient and visit ids are required' });
  }

  try {
    const queryText = `
      SELECT v.*
      FROM vitals v
      INNER JOIN visits vi ON vi.id = v.visit_id
      WHERE vi.patient_id = $1 AND vi.id = $2
    `;

    const result = await db.query(queryText, [id, visit_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vitals not found' });
    }

    res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('Error fetching patient vitals:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: history
router.get('/history/:id/:visit_id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id, visit_id } = req.params;

  if (!id || !visit_id) {
    return res.status(400).json({ error: 'Patient and visit ids are required' });
  }

  try {
    const queryText = `
      SELECT h.*
      FROM history h
      INNER JOIN visits vi ON vi.id = h.visit_id
      WHERE vi.patient_id = $1 AND vi.id = $2
    `;

    const result = await db.query(queryText, [id, visit_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'History not found' });
    }

    res.status(200).json(result.rows[0]);

  } catch (err) {
    console.error('Error fetching patient history:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: visual_acuity
router.get('/visual-acuity/:id/:visit_id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id, visit_id } = req.params;

  if (!id || !visit_id) {
    return res.status(400).json({ error: 'Patient id and Visit id are required' });
  }

  try {
    const queryText = `
      SELECT va.*
      FROM visual_acuity va
      INNER JOIN visits vi ON vi.id = va.visit_id
      WHERE vi.patient_id = $1 AND va.visit_id = $2
    `;

    const result = await db.query(queryText, [id, visit_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Visual acuity data not found for this patient/visit" });
    }

    res.status(200).json(result.rows[0]); // one record per visit
  } catch (err) {
    console.error('Error fetching visual acuity:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET: presenting complaints
router.get('/presenting-complaint/:id/:visit_id', authenticateToken, requireRole(['any']), async (req, res) => {
  const { id, visit_id } = req.params;

  if (!id || !visit_id) {
    return res.status(400).json({ error: 'Patient id and Visit id are required' });
  }

  try {
    const queryText = `
      SELECT pc.*
      FROM presenting_complaint pc
      INNER JOIN visits vi ON vi.id = pc.visit_id
      WHERE vi.patient_id = $1 AND pc.visit_id = $2
    `;

    const result = await db.query(queryText, [id, visit_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Presenting complaint not found for this patient/visit" });
    }

    res.status(200).json(result.rows[0]); // one record per visit
  } catch (err) {
    console.error('Error fetching presenting complaint:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// === SEVA === //
// GET: seva
router.get("/seva/:visit_id", authenticateToken, async (req, res) => {
  const { visit_id } = req.params;

  // Validate visit_id
  const visitIdNum = parseInt(visit_id, 10);
  if (isNaN(visitIdNum)) {
    return res.status(400).json({ error: "Invalid visit_id" });
  }

  const query = `
    SELECT
      id,
      visit_id,
      left_with_pinhole_new,
      right_with_pinhole_new,
      left_without_pinhole_new,
      right_without_pinhole_new,
      diagnosis,
      date_of_referral,
      notes,
      last_updated_by,
      last_updated_at,
      created_at
    FROM seva
    WHERE visit_id = $1;
  `;

  try {
    const { rows } = await db.query(query, [visitIdNum]);

    if (rows.length === 0) {
      return res.status(200).json(null);
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("❌ Error fetching SEVA record:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// UPSERT: seva
router.post('/seva/:visit_id', authenticateToken, async (req, res) => {
  const { visit_id } = req.params;

  // Ensure visit_id is numeric
  if (!visit_id) {
    return res.status(400).json({ error: "visit_id is required" });
  }

  const {
    left_with_pinhole_new,
    right_with_pinhole_new,
    left_without_pinhole_new,
    right_without_pinhole_new,
    diagnosis,
    date_of_referral,
    notes = "",
  } = req.body;

  const last_updated_by = req.user.id;

  const query = `
    INSERT INTO seva (
      visit_id,
      left_with_pinhole_new,
      right_with_pinhole_new,
      left_without_pinhole_new,
      right_without_pinhole_new,
      diagnosis,
      date_of_referral,
      notes,
      last_updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (visit_id) DO UPDATE SET
      left_with_pinhole_new = EXCLUDED.left_with_pinhole_new,
      right_with_pinhole_new = EXCLUDED.right_with_pinhole_new,
      left_without_pinhole_new = EXCLUDED.left_without_pinhole_new,
      right_without_pinhole_new = EXCLUDED.right_without_pinhole_new,
      diagnosis = EXCLUDED.diagnosis,
      date_of_referral = EXCLUDED.date_of_referral,
      notes = EXCLUDED.notes,
      last_updated_by = EXCLUDED.last_updated_by,
      last_updated_at = NOW()
    RETURNING *;
  `;

  try {
    const { rows } = await db.query(query, [
      visit_id,
      left_with_pinhole_new,
      right_with_pinhole_new,
      left_without_pinhole_new,
      right_without_pinhole_new,
      diagnosis,
      date_of_referral,
      notes,
      last_updated_by,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "SEVA record not found or not created" });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("❌ Error upserting seva:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === PHYSIOTHERAPY === //

// GET physiotherapy
router.get("/physiotherapy/:visit_id", authenticateToken, async (req, res) => {
  const { visit_id } = req.params;

  // Validate visit_id
  const visitIdNum = parseInt(visit_id, 10);
  if (isNaN(visitIdNum)) {
    return res.status(400).json({ error: "Invalid visit_id" });
  }

  try {
    // Fetch physiotherapy record
    const physioQuery = `
      SELECT
        id,
        visit_id,
        notes,
        last_updated_by,
        last_updated_at,
        created_at
      FROM physiotherapy
      WHERE visit_id = $1;
    `;
    const physioResult = await db.query(physioQuery, [visitIdNum]);

    if (physioResult.rows.length === 0) {
      return res.status(200).json(null);
    }

    const physio = physioResult.rows[0];

    // Fetch painpoints
    const painpointsQuery = `
      SELECT
        id,
        x_coord,
        y_coord,
        last_updated_by,
        last_updated_at,
        created_at
      FROM painpoints
      WHERE physiotherapy_id = $1;
    `;
    const painpointsResult = await db.query(painpointsQuery, [physio.id]);

    // Map snake_case to camelCase
    const painpoints = painpointsResult.rows.map(pp => ({
      id: pp.id,
      xCoord: pp.x_coord,
      yCoord: pp.y_coord,
      lastUpdatedBy: pp.last_updated_by,
      lastUpdatedAt: pp.last_updated_at,
      createdAt: pp.created_at,
    }));

    const response = {
      id: physio.id,
      visitId: physio.visit_id,
      notes: physio.notes,
      lastUpdatedBy: physio.last_updated_by,
      lastUpdatedAt: physio.last_updated_at,
      createdAt: physio.created_at,
      painpoints,
    };

    res.status(200).json(response);

  } catch (err) {
    console.error("❌ Error fetching physiotherapy with painpoints:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// UPSERT physiotherapy
router.post("/physiotherapy/:visit_id", authenticateToken, async (req, res) => {
  const { visit_id } = req.params;

  if (!visit_id) {
    return res.status(400).json({ error: "visit_id is required" });
  }

  const { notes = "", painpoints = [] } = req.body;
  const last_updated_by = req.user.id;

  try {
    // Upsert physiotherapy record
    const physioQuery = `
      INSERT INTO physiotherapy (visit_id, notes, last_updated_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (visit_id) DO UPDATE SET
        notes = EXCLUDED.notes,
        last_updated_by = EXCLUDED.last_updated_by,
        last_updated_at = NOW()
      RETURNING id, visit_id, notes, last_updated_by, last_updated_at, created_at;
    `;
    const { rows } = await db.query(physioQuery, [visit_id, notes, last_updated_by]);
    const physio = rows[0];

    // Delete existing painpoints for this physiotherapy (simple approach)
    await db.query("DELETE FROM painpoints WHERE physiotherapy_id = $1", [physio.id]);

    // Insert new painpoints
    const painpointPromises = painpoints.map(pp => 
      db.query(
        `INSERT INTO painpoints (physiotherapy_id, x_coord, y_coord, last_updated_by)
         VALUES ($1, $2, $3, $4)`,
        [physio.id, pp.xCoord, pp.yCoord, last_updated_by]
      )
    );
    await Promise.all(painpointPromises);

    // Fetch updated painpoints
    const { rows: painpointRows } = await db.query(
      `SELECT id, x_coord, y_coord, last_updated_by, last_updated_at, created_at
       FROM painpoints
       WHERE physiotherapy_id = $1`,
      [physio.id]
    );

    // Return combined data
    res.status(200).json({
      notes: physio.notes,
      lastUpdatedBy: physio.last_updated_by,
      lastUpdatedAt: physio.last_updated_at,
      createdAt: physio.created_at,
      painpoints: painpointRows.map(pp => ({
        id: pp.id,
        xCoord: pp.x_coord,
        yCoord: pp.y_coord,
        lastUpdatedBy: pp.last_updated_by,
        lastUpdatedAt: pp.last_updated_at,
        createdAt: pp.created_at,
      })),
    });

  } catch (err) {
    console.error("❌ Error upserting physiotherapy:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === DOCTOR'S CONSULTATION == //

// GET: consultation
router.get("/consultation/:visit_id", authenticateToken, async (req, res) => {
  const { visit_id } = req.params;

  // Validate visit_id
  const visitIdNum = parseInt(visit_id, 10);
  if (isNaN(visitIdNum)) {
    return res.status(400).json({ error: "Invalid visit_id" });
  }

  const query = `
    SELECT
      c.id,
      c.visit_id,
      c.notes,
      c.prescription,
      c.require_referral,
      c.last_updated_by,
      c.last_updated_at,
      c.created_at,
      r.referral_type,
      r.illness,
      r.duration,
      r.reason,
      r.referral_date
    FROM consultation c
    LEFT JOIN referral r ON r.visit_id = c.visit_id
    WHERE c.visit_id = $1;
  `;

  try {
    const { rows } = await db.query(query, [visitIdNum]);

    if (rows.length === 0) {
      return res.status(200).json(null);
    }

    const row = rows[0];

    // Optional: generate a weak ETag based on last_updated_at + id
    const etag = `"${row.id}-${new Date(row.last_updated_at).getTime()}"`;
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    res.setHeader("ETag", etag);
    res.status(200).json(row);
  } catch (err) {
    console.error("❌ Error fetching consultation record:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// UPSERT: consultation
router.post('/consultation/:visit_id', authenticateToken, async (req, res) => {
  const { visit_id } = req.params;

  if (!visit_id) {
    return res.status(400).json({ error: "visit_id is required" });
  }

  const {
    notes,
    prescription,
    require_referral,
  } = req.body;

  const last_updated_by = req.user.id;

  const query = `
    INSERT INTO consultation (
      visit_id,
      notes,
      prescription,
      require_referral,
      last_updated_by
    )
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (visit_id) DO UPDATE SET
      notes = EXCLUDED.notes,
      prescription = EXCLUDED.prescription,
      require_referral = EXCLUDED.require_referral,
      last_updated_by = EXCLUDED.last_updated_by,
      last_updated_at = NOW()
    RETURNING *;
  `;

  try {
    const { rows } = await db.query(query, [
      visit_id,
      notes,
      prescription,
      require_referral,
      last_updated_by,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Consultation record not found or not created" });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("❌ Error upserting consultation:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// UPSERT: referral
router.post("/referral/:visit_id", authenticateToken, async (req, res) => {
  const { visit_id } = req.params;

  if (!visit_id) {
    return res.status(400).json({ error: "visit_id is required" });
  }

  const { referralDate, referralType, illness, duration, reason } = req.body;
  const last_updated_by = req.user.id;

  const query = `
    INSERT INTO referral (
      visit_id,
      referral_date,
      referral_type,
      illness,
      duration,
      reason,
      last_updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (visit_id) DO UPDATE SET
      referral_date = EXCLUDED.referral_date,
      referral_type = EXCLUDED.referral_type,
      illness = EXCLUDED.illness,
      duration = EXCLUDED.duration,
      reason = EXCLUDED.reason,
      last_updated_by = EXCLUDED.last_updated_by,
      last_updated_at = NOW()
    RETURNING *;
  `;

  try {
    const { rows } = await db.query(query, [
      visit_id,
      referralDate,
      referralType,
      illness,
      duration,
      reason,
      last_updated_by,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Referral record not created or found" });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("❌ Error upserting referral:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


module.exports = router;