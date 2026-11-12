// routes/export.js
// GET /api/export/patients - the print permission (utils/permissions.js). Every patient with every
// visit (an account without view_past: the patients queued on its day), one
// row per visit (a patient with no visits gets one row with blank visit columns), for the "Download
// all patient data" spreadsheet on Patient List. Columns are flat text/number values in a fixed order.
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('./auth');
const { patientOnDaySql } = require('../utils/dayScope');

router.get('/patients', authenticateToken, async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      p.id AS patient_id, p.face_id, p.family,
      p.english_name, p.khmer_name, TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth, p.sex,
      p.address, p.phone_number,
      v.id AS visit_id, TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, v.queue_no,
      v.sticker_colour,
      TO_CHAR(v.completed_at, 'YYYY-MM-DD HH24:MI') AS discharged_at,
      (SELECT string_agg(s.station, ' > ' ORDER BY s.position, s.id) FROM visit_stations s WHERE s.visit_id = v.id) AS stations,
      vt.height, vt.weight, vt.bmi, vt.below_3rd_percentile, vt.bp_systolic, vt.bp_diastolic, vt.temperature,
      vt.notes AS vitals_notes,
      h.know_of_hef, h.has_hef, h.notes AS hef_notes,
      va.left_without_pinhole, va.left_with_pinhole, va.left_with_glasses,
      va.right_without_pinhole, va.right_with_pinhole, va.right_with_glasses,
      va.notes AS visual_acuity_notes,
      pc.history AS complaint_history, pc.red_flags AS complaint_red_flags,
      pc.systems_review AS complaint_systems_review, pc.drug_allergies,
      hist.past AS past_history, hist.drug_and_treatment, hist.family AS family_history,
      hist.social AS social_history, hist.systems_review AS history_systems_review,
      tb.status AS tb_status, array_to_string(tb.red_flags, '; ') AS tb_red_flags, tb.flag_notes AS tb_notes,
      c.notes AS consultation_notes, c.prescription AS consultation_prescription,
      array_to_string(c.condition_categories, '; ') AS conditions,
      r.referral_type, TO_CHAR(r.referral_date, 'YYYY-MM-DD') AS referral_date, r.illness AS referral_illness,
      r.duration AS referral_duration, r.reason AS referral_reason, r.signer_name AS referral_signed_by,
      pt.notes AS physiotherapy_notes,
      d.notes AS dental_notes, d.referral_needed AS dental_referral_needed,
      s.diagnosis AS partner_ngo_diagnosis, s.referral AS partner_ngo_referral, s.notes AS partner_ngo_notes,
      s.left_without_pinhole_new AS partner_ngo_left_without_pinhole, s.left_with_pinhole_new AS partner_ngo_left_with_pinhole,
      s.left_with_glasses_new AS partner_ngo_left_with_glasses,
      s.right_without_pinhole_new AS partner_ngo_right_without_pinhole, s.right_with_pinhole_new AS partner_ngo_right_with_pinhole,
      s.right_with_glasses_new AS partner_ngo_right_with_glasses,
      (SELECT string_agg(pr.drug_name || ' x' || pr.quantity || ' (' || pr.status || ')', '; ' ORDER BY pr.id)
         FROM prescriptions pr WHERE pr.visit_id = v.id) AS prescriptions,
      TO_CHAR(GREATEST(p.last_updated_at, v.last_updated_at), 'YYYY-MM-DD HH24:MI') AS last_updated_at
    FROM patients p
    LEFT JOIN visits v ON v.patient_id = p.id
    LEFT JOIN vitals vt ON vt.visit_id = v.id
    LEFT JOIN hef h ON h.visit_id = v.id
    LEFT JOIN visual_acuity va ON va.visit_id = v.id
    LEFT JOIN presenting_complaint pc ON pc.visit_id = v.id
    LEFT JOIN history hist ON hist.visit_id = v.id
    LEFT JOIN tb_screening tb ON tb.visit_id = v.id
    LEFT JOIN consultation c ON c.visit_id = v.id
    LEFT JOIN referral r ON r.visit_id = v.id
    LEFT JOIN physiotherapy pt ON pt.visit_id = v.id
    LEFT JOIN dental d ON d.visit_id = v.id
    LEFT JOIN seva s ON s.visit_id = v.id
    WHERE ${patientOnDaySql('p.id', '$1')}
    ORDER BY p.english_name, p.id, v.visit_date, v.id
  `, [req.user.scope_date ?? null]);
  res.setHeader('Cache-Control', 'no-store');
  res.json(rows);
});

module.exports = router;
