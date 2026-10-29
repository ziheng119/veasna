const { validConditions } = require('../utils/consultationConditions');
const { validateSignature } = require('../utils/referralSignature');
// routes/visits.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');
const { normalizeSexToEnum } = require('../utils/sex');
const { currentVisitDate, lockQueue, getNextQueueNo } = require('../utils/queueNumber');
const { STATIONS, normalizeStations, stationPosition } = require('../utils/stations');
const { normalizeSnellenFields } = require('../utils/snellen');
const { textOrEmpty, dateOrNull } = require('../utils/partialFields');
const { TB_STATION, normalizeRedFlags, rejectIfTbHold, flagTb } = require('../utils/tb');

const SEVA_REFERRALS = ['cataract_surgery', 'seva_general'];

// Include completed visits and unsigned drafts, not just patients still queued.
router.get('/referrals', authenticateToken, async (req, res) => {
  const locationId = Number(req.query.location_id);
  const date = req.query.date;
  if (!Number.isSafeInteger(locationId) || locationId <= 0 ||
      typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ error: 'A valid location_id and date (YYYY-MM-DD) are required' });
  }
  try {
    const { rows } = await db.query(`
      SELECT r.visit_id, r.referral_type, r.illness, r.duration, r.reason,
        TO_CHAR(r.referral_date, 'YYYY-MM-DD') AS referral_date,
        r.signature, r.signer_name, r.signer_id, r.signed_at,
        p.id AS patient_id, p.english_name, p.khmer_name, p.sex, p.address,
        TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth
      FROM referral r
      JOIN visits v ON v.id = r.visit_id
      JOIN patients p ON p.id = v.patient_id
      WHERE v.location_id = $1 AND COALESCE(r.referral_date, v.visit_date) = $2::date
      ORDER BY v.created_at ASC, v.id ASC
    `, [locationId, date]);
    res.setHeader('Cache-Control', 'no-store');
    res.json(rows);
  } catch (error) {
    console.error('Daily referral retrieval failed:', error);
    res.status(500).json({ error: 'Unable to load referrals' });
  }
});

function parseOptionalPositiveInt(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return parsed > 0 ? parsed : null;
}

function parseRequiredNumber(value) {
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

function parseRequiredInt(value) {
  const num = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(num) ? num : null;
}

// POST /api/visits (Create a new patient visit)
router.post('/', authenticateToken, requireRole(['any']), async (req, res) => {
    const last_updated_by = req.user.id;
    const { patientInfo, visit, vitals, hef } = req.body;
    // Stations the patient is indicated for. Optional: defaults to every station except the TB tent.
    let stations = req.body.stations === undefined
        ? STATIONS.filter((station) => station !== TB_STATION)
        : normalizeStations(req.body.stations);
    // Optional TB flag: { red_flags: [...], notes }. A flagged visit starts at the TB tent and is
    // held there until a TB doctor clears it.
    const tb = req.body.tb ?? null;
    const tbRedFlags = tb ? normalizeRedFlags(tb.red_flags) : [];
    const normalizedPatientSex = normalizeSexToEnum(patientInfo?.sex);
    const locationId = parseOptionalPositiveInt(patientInfo?.location_id);
    // Optional: when omitted, the next sequential number for the location and date is assigned.
    let queueNo = typeof visit?.queue_no === 'string' ? visit.queue_no.trim() : '';

    if (!locationId) {
        return res.status(400).json({ error: 'Valid patientInfo.location_id is required.' });
    }

    if (!hef) {
        return res.status(400).json({ error: 'hef is required.' });
    }

    if (!stations || stations.length === 0) {
        return res.status(400).json({ error: `stations must be a non-empty list of: ${STATIONS.join(', ')}.` });
    }

    if (tb !== null && (typeof tb !== 'object' || tbRedFlags === null)) {
        return res.status(400).json({ error: 'tb must be an object with red_flags as a list of text.' });
    }
    const tbFlagged = tb !== null || stations.includes(TB_STATION);
    if (tbFlagged && !stations.includes(TB_STATION)) {
        stations = [TB_STATION, ...stations];
    }

    if (patientInfo?.sex != null && String(patientInfo.sex).trim() !== '' && normalizedPatientSex === null) {
        return res.status(400).json({ error: 'Invalid patientInfo.sex. Use M or F.' });
    }

    const height = parseRequiredNumber(vitals?.height);
    const weight = parseRequiredNumber(vitals?.weight);
    const bmi = parseRequiredNumber(vitals?.bmi);
    const bpSystolic = parseRequiredInt(vitals?.bp_systolic);
    const bpDiastolic = parseRequiredInt(vitals?.bp_diastolic);
    const temperature = parseRequiredNumber(vitals?.temperature);
    const below3rdPercentile = typeof vitals?.below_3rd_percentile === 'boolean' ? vitals.below_3rd_percentile : null;

    if (
        height === null || height <= 0 ||
        weight === null || weight <= 0 ||
        bmi === null || bmi <= 0 ||
        bpSystolic === null || bpSystolic <= 0 ||
        bpDiastolic === null || bpDiastolic <= 0 ||
        temperature === null || temperature <= 0 ||
        below3rdPercentile === null
    ) {
        return res.status(400).json({ error: 'Invalid vitals payload. Please provide valid numeric values and below_3rd_percentile.' });
    }

    let client;
    try {
        client = await db.pool.connect();
    } catch (err) {
        console.error('Failed to acquire database connection:', err);
        return res.status(500).json({ error: 'Database connection unavailable' });
    }
    try {
        await client.query('BEGIN');

        // Step 1: Insert or Find/Update the patient
        let patientId = parseOptionalPositiveInt(patientInfo?.id);
        if (!patientId) {
            const patientQuery = `
                INSERT INTO patients (location_id, english_name, khmer_name, date_of_birth, sex, address, phone_number, last_updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id;
            `;
            // face_id is generated by a database trigger from the names and date of birth.
            const patientValues = [
                locationId,
                patientInfo.english_name,
                patientInfo.khmer_name,
                patientInfo.date_of_birth || null,
                normalizedPatientSex,
                patientInfo.address,
                patientInfo.phone_number,
                last_updated_by
            ];
            const patientResult = await client.query(patientQuery, patientValues);
            patientId = patientResult.rows[0].id;
        } else if (req.user.role === 'admin') {
            await client.query(
                `UPDATE patients SET
                    english_name = COALESCE($1, english_name),
                    khmer_name = COALESCE($2, khmer_name),
                    date_of_birth = COALESCE($3, date_of_birth),
                    sex = COALESCE($4, sex),
                    address = COALESCE($5, address),
                    phone_number = COALESCE($6, phone_number),
                    last_updated_by = $7
                WHERE id = $8`,
                [
                    patientInfo.english_name || null,
                    patientInfo.khmer_name || null,
                    patientInfo.date_of_birth || null,
                    normalizedPatientSex,
                    patientInfo.address || null,
                    patientInfo.phone_number || null,
                    last_updated_by,
                    patientId
                ]
            );
        }

        // Step 2: Insert into visits table
        const visitDate = currentVisitDate();
        if (!queueNo) {
            await lockQueue(client, locationId);
            queueNo = await getNextQueueNo(client, locationId, visitDate);
        }
        const visitQuery = `
            INSERT INTO visits (patient_id, location_id, queue_no, visit_date, last_updated_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, created_at;
        `;
        const visitValues = [
            patientId,
            locationId,
            queueNo,
            visitDate,
            last_updated_by
        ];
        const visitResult = await client.query(visitQuery, visitValues);
        const visitId = visitResult.rows[0].id;
        const visitTimestamp = visitResult.rows[0].created_at;

        // Step 2b: Queue the visit at its first station; later stations are entered as each one completes
        for (const [index, station] of stations.entries()) {
            await client.query(
                `INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
                 VALUES ($1, $2, $3, CASE WHEN $4 THEN NOW() END, $5)`,
                [visitId, station, stationPosition(station), index === 0, last_updated_by]
            );
        }

        if (tbFlagged) {
            await flagTb(client, visitId, { redFlags: tbRedFlags, notes: textOrEmpty(tb?.notes) }, last_updated_by);
        }

        // Step 3: Insert into vitals table
        const vitalsQuery = `
            INSERT INTO vitals (visit_id, height, weight, bmi, below_3rd_percentile, bp_systolic, bp_diastolic, temperature, notes, last_updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
        `;
        const vitalsValues = [
            visitId,
            height,
            weight,
            bmi,
            below3rdPercentile,
            bpSystolic,
            bpDiastolic,
            temperature,
            vitals.notes,
            last_updated_by
        ];
        await client.query(vitalsQuery, vitalsValues);

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
        await client.query(hefQuery, hefValues);

        await client.query('COMMIT');

        res.status(201).json({
            visit_id: visitId,
            patient_id: patientId,
            queue_no: queueNo,
            current_station: stations[0],
            tb_status: tbFlagged ? 'suspected' : null,
            english_name: patientInfo.english_name,
            khmer_name: patientInfo.khmer_name,
            age: patientInfo.age,
            sex: normalizedPatientSex ?? patientInfo.sex ?? null,
            timestamp: new Date(visitTimestamp).toLocaleTimeString()
        });

    } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        if (err && err.code === '23505') {
            return res.status(409).json({ error: 'Duplicate queue number for this location and date' });
        }
        console.error('Error in registration transaction:', err);
        res.status(500).json({ error: 'Failed to register patient' });
    } finally {
        client.release();
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
      referral,
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

// GET: patients at a location that Seva has marked for referral, newest visit first
router.get('/seva-referrals', authenticateToken, async (req, res) => {
  const locationId = parseOptionalPositiveInt(req.query.location_id);
  if (!locationId) {
    return res.status(400).json({ error: 'Valid location_id is required' });
  }

  try {
    const { rows } = await db.query(
      `
      SELECT
        s.visit_id,
        s.referral,
        s.diagnosis,
        s.date_of_referral,
        v.visit_date,
        v.queue_no,
        p.id AS patient_id,
        p.english_name,
        p.khmer_name,
        p.date_of_birth,
        p.sex,
        p.phone_number,
        p.face_id
      FROM seva s
      JOIN visits v ON v.id = s.visit_id
      JOIN patients p ON p.id = v.patient_id
      WHERE v.location_id = $1 AND s.referral IS NOT NULL
      ORDER BY v.visit_date DESC, s.last_updated_at DESC
      `,
      [locationId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching SEVA referrals:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// UPSERT: seva
router.post('/seva/:visit_id', authenticateToken, async (req, res) => {
  const { visit_id } = req.params;

  // Ensure visit_id is numeric
  if (!visit_id) {
    return res.status(400).json({ error: "visit_id is required" });
  }
  if (await rejectIfTbHold(db, res, visit_id)) return;

  const {
    diagnosis,
    date_of_referral,
    notes = "",
  } = req.body;

  // Who needs referring: null/blank means no referral.
  const referral = req.body.referral === undefined || req.body.referral === '' ? null : req.body.referral;
  if (referral !== null && !SEVA_REFERRALS.includes(referral)) {
    return res.status(400).json({ error: `referral must be one of: ${SEVA_REFERRALS.join(', ')}, or blank.` });
  }

  const acuity = normalizeSnellenFields(req.body, [
    'left_with_pinhole_new',
    'right_with_pinhole_new',
    'left_without_pinhole_new',
    'right_without_pinhole_new',
  ]);
  if (acuity.error) {
    return res.status(400).json({ error: acuity.error });
  }
  const {
    left_with_pinhole_new,
    right_with_pinhole_new,
    left_without_pinhole_new,
    right_without_pinhole_new,
  } = acuity.values;

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
      last_updated_by,
      referral
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (visit_id) DO UPDATE SET
      left_with_pinhole_new = EXCLUDED.left_with_pinhole_new,
      right_with_pinhole_new = EXCLUDED.right_with_pinhole_new,
      left_without_pinhole_new = EXCLUDED.left_without_pinhole_new,
      right_without_pinhole_new = EXCLUDED.right_without_pinhole_new,
      diagnosis = EXCLUDED.diagnosis,
      date_of_referral = EXCLUDED.date_of_referral,
      referral = EXCLUDED.referral,
      notes = EXCLUDED.notes,
      last_updated_by = EXCLUDED.last_updated_by,
      last_updated_at = NOW()
    -- Only the verified admin role may update a conflicting saved row.
    WHERE ${req.user.role === 'admin'}
    RETURNING *;
  `;

  try {
    const { rows } = await db.query(query, [
      visit_id,
      left_with_pinhole_new,
      right_with_pinhole_new,
      left_without_pinhole_new,
      right_without_pinhole_new,
      textOrEmpty(diagnosis),
      dateOrNull(date_of_referral),
      textOrEmpty(notes),
      last_updated_by,
      referral,
    ]);

    if (rows.length === 0) {
      return res.status(403).json({ error: "Only admins can edit saved SEVA notes." });
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
  if (await rejectIfTbHold(db, res, visit_id)) return;

  const { notes = "", painpoints = [] } = req.body;
  if (painpoints !== undefined && !Array.isArray(painpoints)) {
    return res.status(400).json({ error: 'painpoints must be an array' });
  }
  const last_updated_by = req.user.id;

  let client;
  try {
    client = await db.pool.connect();
  } catch (err) {
    console.error('Failed to acquire database connection:', err);
    return res.status(500).json({ error: 'Database connection unavailable' });
  }
  try {
    await client.query('BEGIN');

    const physioQuery = `
      INSERT INTO physiotherapy (visit_id, notes, last_updated_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (visit_id) DO UPDATE SET
        notes = EXCLUDED.notes,
        last_updated_by = EXCLUDED.last_updated_by,
        last_updated_at = NOW()
      WHERE ${req.user.role === 'admin'}
    RETURNING id, visit_id, notes, last_updated_by, last_updated_at, created_at;
    `;
    const { rows } = await client.query(physioQuery, [visit_id, notes, last_updated_by]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only admins can edit saved records.' });
    }
    const physio = rows[0];

    await client.query("DELETE FROM painpoints WHERE physiotherapy_id = $1", [physio.id]);

    for (const pp of painpoints) {
      const x = parseFloat(pp.xCoord);
      const y = parseFloat(pp.yCoord);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Each painpoint must have valid numeric xCoord and yCoord' });
      }
      await client.query(
        `INSERT INTO painpoints (physiotherapy_id, x_coord, y_coord, last_updated_by)
         VALUES ($1, $2, $3, $4)`,
        [physio.id, x, y, last_updated_by]
      );
    }

    const { rows: painpointRows } = await client.query(
      `SELECT id, x_coord, y_coord, last_updated_by, last_updated_at, created_at
       FROM painpoints
       WHERE physiotherapy_id = $1`,
      [physio.id]
    );

    await client.query('COMMIT');

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
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error("Error upserting physiotherapy:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    client.release();
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
      c.condition_categories,
      c.prescription,
      c.require_referral,
      c.last_updated_by,
      c.last_updated_at,
      c.created_at,
      r.referral_type,
      r.illness,
      r.duration,
      r.reason,
      r.referral_date,
      r.signature, r.signer_name, r.signer_id, r.signed_at,
      r.last_updated_at AS referral_updated_at
    FROM consultation c
    FULL JOIN referral r ON r.visit_id = c.visit_id
    WHERE COALESCE(c.visit_id, r.visit_id) = $1;
  `;

  try {
    const { rows } = await db.query(query, [visitIdNum]);

    if (rows.length === 0) {
      return res.status(200).json(null);
    }

    const row = rows[0];

    // Optional: generate a weak ETag based on last_updated_at + id
    const etag = `"${row.id}-${new Date(row.last_updated_at).getTime()}-${new Date(row.referral_updated_at).getTime()}"`;
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
  if (await rejectIfTbHold(db, res, visit_id)) return;

  const {
    notes,
    prescription,
  } = req.body;

  if (!validConditions(req.body.condition_categories)) return res.status(400).json({ error: 'Select valid condition categories without duplicates.' });
  const conditionsProvided = Object.prototype.hasOwnProperty.call(req.body, 'condition_categories');
  const last_updated_by = req.user.id;

  const query = `
    INSERT INTO consultation (
      visit_id,
      notes,
      prescription,
      condition_categories,
      require_referral,
      last_updated_by
    )
    VALUES ($1, $2, $3, $5::text[], EXISTS (SELECT 1 FROM referral WHERE visit_id = $1), $4)
    ON CONFLICT (visit_id) DO UPDATE SET
      notes = EXCLUDED.notes,
      condition_categories = CASE WHEN $6::boolean THEN EXCLUDED.condition_categories ELSE consultation.condition_categories END,
      prescription = EXCLUDED.prescription,
      require_referral = EXCLUDED.require_referral,
      last_updated_by = EXCLUDED.last_updated_by,
      last_updated_at = NOW()
    WHERE ${req.user.role === 'admin'}
    RETURNING *;
  `;

  try {
    const { rows } = await db.query(query, [
      visit_id,
      textOrEmpty(notes),
      textOrEmpty(prescription),
      last_updated_by,
      req.body.condition_categories ?? null,
      conditionsProvided,
    ]);

    if (rows.length === 0) {
      return res.status(403).json({ error: "Only admins can edit saved consultation notes." });
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
  if (await rejectIfTbHold(db, res, visit_id)) return;

  const { referralDate, referralType, illness, duration, reason, signature } = req.body;
  if (!validateSignature(signature)) return res.status(400).json({ error: "Invalid signature. Please clear and sign again." });
  const last_updated_by = req.user.id;

  const query = `
    WITH saved AS (INSERT INTO referral (
      visit_id,
      referral_date,
      referral_type,
      illness,
      duration,
      reason,
      last_updated_by, signature, signer_id, signer_name, signed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb,
      CASE WHEN $8::jsonb IS NULL THEN NULL ELSE $7::integer END,
      CASE WHEN $8::jsonb IS NULL THEN NULL ELSE (SELECT username FROM users WHERE id = $7::integer) END,
      CASE WHEN $8::jsonb IS NULL THEN NULL ELSE NOW() END)
    ON CONFLICT (visit_id) DO UPDATE SET
      referral_date = EXCLUDED.referral_date,
      referral_type = EXCLUDED.referral_type,
      illness = EXCLUDED.illness,
      duration = EXCLUDED.duration,
      reason = EXCLUDED.reason,
      last_updated_by = EXCLUDED.last_updated_by,
      signature = EXCLUDED.signature,
      -- Preserve attribution when saving existing strokes unchanged.
      signer_id = CASE WHEN referral.signature = EXCLUDED.signature THEN referral.signer_id ELSE EXCLUDED.signer_id END,
      signer_name = CASE WHEN referral.signature = EXCLUDED.signature THEN referral.signer_name ELSE EXCLUDED.signer_name END,
      signed_at = CASE WHEN referral.signature = EXCLUDED.signature THEN referral.signed_at ELSE EXCLUDED.signed_at END,
      last_updated_at = NOW()
    WHERE ${req.user.role === 'admin'}
    RETURNING *), updated AS (
      UPDATE consultation SET require_referral = TRUE, last_updated_by = $7, last_updated_at = NOW()
      WHERE visit_id = $1 AND EXISTS (SELECT 1 FROM saved) RETURNING visit_id
    ) SELECT * FROM saved;
  `;

  try {
    const { rows } = await db.query(query, [
      visit_id,
      dateOrNull(referralDate),
      textOrEmpty(referralType),
      textOrEmpty(illness),
      textOrEmpty(duration),
      textOrEmpty(reason),
      last_updated_by,
      signature == null ? null : JSON.stringify(signature),
    ]);

    if (rows.length === 0) {
      return res.status(403).json({ error: "Only admins can edit saved referrals." });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("❌ Error upserting referral:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// Delete the visit's referral and clear its consultation flag atomically.
// Notes/prescription stay intact; repeating a successful deletion is harmless.
router.delete("/referral/:visit_id", authenticateToken, async (req, res) => {
  const visitId = Number(req.params.visit_id);
  if (!Number.isSafeInteger(visitId) || visitId <= 0) return res.status(400).json({ error: "Invalid visit_id" });
  try {
    if (await rejectIfTbHold(db, res, visitId)) return;
    await db.query(`
      WITH deleted AS (DELETE FROM referral WHERE visit_id = $1 RETURNING id)
      UPDATE consultation SET require_referral = FALSE, last_updated_by = $2, last_updated_at = NOW()
      WHERE visit_id = $1
    `, [visitId, req.user.id]);
    res.sendStatus(204);
  } catch (error) {
    console.error("Referral deletion failed:", error);
    res.status(500).json({ error: "Unable to delete referral" });
  }
});

module.exports = router;
