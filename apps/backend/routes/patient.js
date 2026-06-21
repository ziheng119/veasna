 // routes/patient.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('../routes/auth');

// GET /api/patient/:id - Get patient information with visits list (lightweight)
router.get('/:id', authenticateToken, requireRole(['any']), async (req, res) => {
  // Support ETag for caching
  const ifNoneMatch = req.headers['if-none-match'];
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    // Get basic patient information
    const patientQuery = `
      SELECT 
        p.id,
        p.face_id,
        p.location_id,
        p.english_name,
        p.khmer_name,
        p.date_of_birth,
        p.sex,
        p.address,
        p.phone_number,
        p.last_updated_at,
        p.created_at,
        l.name AS location_name
      FROM patients p
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE p.id = $1
    `;
    const patientResult = await db.query(patientQuery, [id]);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const patient = patientResult.rows[0];

    // Get visits list (lightweight - just basic info)
    const visitsQuery = `
      SELECT 
        v.id AS visit_id,
        v.queue_no,
        v.visit_date,
        v.last_updated_at,
        l.name AS location_name,
        -- Check which sections have data
        CASE WHEN vt.id IS NOT NULL THEN true ELSE false END AS has_vitals,
        CASE WHEN pc.id IS NOT NULL THEN true ELSE false END AS has_presenting_complaint,
        CASE WHEN s.id IS NOT NULL THEN true ELSE false END AS has_seva,
        CASE WHEN pt.id IS NOT NULL THEN true ELSE false END AS has_physiotherapy,
        CASE WHEN c.id IS NOT NULL THEN true ELSE false END AS has_consultation
      FROM visits v
      LEFT JOIN locations l ON v.location_id = l.id
      LEFT JOIN vitals vt ON v.id = vt.visit_id
      LEFT JOIN presenting_complaint pc ON v.id = pc.visit_id
      LEFT JOIN seva s ON v.id = s.visit_id
      LEFT JOIN physiotherapy pt ON v.id = pt.visit_id
      LEFT JOIN consultation c ON v.id = c.visit_id
      WHERE v.patient_id = $1
      ORDER BY v.visit_date DESC, v.created_at DESC
    `;
    const visitsResult = await db.query(visitsQuery, [id]);

    const response = {
      patient: patient,
      visits: visitsResult.rows
    };

    // Generate ETag based on last_updated_at
    const etag = `"${patient.last_updated_at}"`;
    
    // Check if client has cached version
    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.status(200).json(response);
  } catch (err) {
    console.error('Error fetching patient data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/visit/:id - Get complete visit details
router.get('/visit/:id', authenticateToken, requireRole(['any']), async (req, res) => {
    const { id } = req.params;
    const ifNoneMatch = req.headers['if-none-match'];
  
    if (!id) {
      return res.status(400).json({ error: 'Visit ID is required' });
    }
  
    try {
      // Get complete visit data
      const visitQuery = `
        SELECT 
          v.id AS visit_id,
          v.patient_id,
          v.queue_no,
          v.visit_date,
          v.last_updated_at AS visit_last_updated,
          v.created_at AS visit_created_at,
          l.name AS location_name,
          
          -- Vitals
          vt.height,
          vt.weight,
          vt.bmi,
          vt.below_3rd_percentile,
          vt.bp_systolic,
          vt.bp_diastolic,
          vt.temperature,
          vt.notes AS vitals_notes,
          
          -- HEF
          h.know_of_hef,
          h.has_hef,
          h.notes AS hef_notes,
          
          -- Visual Acuity
          va.left_with_pinhole,
          va.left_without_pinhole,
          va.right_with_pinhole,
          va.right_without_pinhole,
          va.notes AS visual_acuity_notes,
          
          -- Presenting Complaint
          pc.history AS complaint_history,
          pc.red_flags,
          pc.systems_review AS complaint_systems_review,
          pc.drug_allergies,
          
          -- History
          hist.past AS history_past,
          hist.drug_and_treatment,
          hist.family AS history_family,
          hist.social AS history_social,
          hist.systems_review AS history_systems_review,
          
          -- SEVA
          s.left_with_pinhole_new AS seva_left_with_pinhole,
          s.left_without_pinhole_new AS seva_left_without_pinhole,
          s.right_with_pinhole_new AS seva_right_with_pinhole,
          s.right_without_pinhole_new AS seva_right_without_pinhole,
          s.diagnosis AS seva_diagnosis,
          s.date_of_referral AS seva_referral_date,
          s.notes AS seva_notes,
          
          -- Physiotherapy
          pt.id AS physio_id,
          pt.notes AS physio_notes,
          
          -- Consultation
          c.id AS consultation_id,
          c.notes AS consultation_notes,
          c.prescription,
          c.require_referral
          
        FROM visits v
        LEFT JOIN locations l ON v.location_id = l.id
        LEFT JOIN vitals vt ON v.id = vt.visit_id
        LEFT JOIN hef h ON v.id = h.visit_id
        LEFT JOIN visual_acuity va ON v.id = va.visit_id
        LEFT JOIN presenting_complaint pc ON v.id = pc.visit_id
        LEFT JOIN history hist ON v.id = hist.visit_id
        LEFT JOIN seva s ON v.id = s.visit_id
        LEFT JOIN physiotherapy pt ON v.id = pt.visit_id
        LEFT JOIN consultation c ON v.id = c.visit_id
        WHERE v.id = $1
      `;
      const visitResult = await db.query(visitQuery, [id]);
  
      if (visitResult.rows.length === 0) {
        return res.status(404).json({ error: 'Visit not found' });
      }
  
      const visit = visitResult.rows[0];
  
      // Get painpoints if physiotherapy exists
      let painpoints = [];
      if (visit.physio_id) {
        const painpointsQuery = `
          SELECT 
            id,
            x_coord,
            y_coord,
            last_updated_at
          FROM painpoints
          WHERE physiotherapy_id = $1
          ORDER BY created_at ASC
        `;
        const painpointsResult = await db.query(painpointsQuery, [visit.physio_id]);
        painpoints = painpointsResult.rows;
      }
  
      // Get referrals for this visit (changed from consultation-based to visit-based)
      let referrals = [];
      const referralQuery = `
        SELECT 
          id,
          referral_date,
          referral_type,
          illness,
          duration,
          reason,
          last_updated_at
        FROM referral
        WHERE visit_id = $1
        ORDER BY referral_date DESC
      `;
      const referralResult = await db.query(referralQuery, [id]);
      referrals = referralResult.rows;
  
      // Structure the response
      const response = {
        visit_id: visit.visit_id,
        patient_id: visit.patient_id,
        queue_no: visit.queue_no,
        visit_date: visit.visit_date,
        location_name: visit.location_name,
        last_updated_at: visit.visit_last_updated,
        created_at: visit.visit_created_at,
        
        vitals: visit.height ? {
          height: visit.height,
          weight: visit.weight,
          bmi: visit.bmi,
          below_3rd_percentile: visit.below_3rd_percentile,
          bp_systolic: visit.bp_systolic,
          bp_diastolic: visit.bp_diastolic,
          temperature: visit.temperature,
          notes: visit.vitals_notes
        } : null,
        
        hef: visit.know_of_hef !== null ? {
          know_of_hef: visit.know_of_hef,
          has_hef: visit.has_hef,
          notes: visit.hef_notes
        } : null,
        
        visual_acuity: visit.left_with_pinhole !== null ? {
          left_with_pinhole: visit.left_with_pinhole,
          left_without_pinhole: visit.left_without_pinhole,
          right_with_pinhole: visit.right_with_pinhole,
          right_without_pinhole: visit.right_without_pinhole,
          notes: visit.visual_acuity_notes
        } : null,
        
        presenting_complaint: visit.complaint_history ? {
          history: visit.complaint_history,
          red_flags: visit.red_flags,
          systems_review: visit.complaint_systems_review,
          drug_allergies: visit.drug_allergies
        } : null,
        
        history: visit.history_past ? {
          past: visit.history_past,
          drug_and_treatment: visit.drug_and_treatment,
          family: visit.history_family,
          social: visit.history_social,
          systems_review: visit.history_systems_review
        } : null,
        
        seva: visit.seva_left_with_pinhole !== null ? {
          left_with_pinhole_new: visit.seva_left_with_pinhole,
          left_without_pinhole_new: visit.seva_left_without_pinhole,
          right_with_pinhole_new: visit.seva_right_with_pinhole,
          right_without_pinhole_new: visit.seva_right_without_pinhole,
          diagnosis: visit.seva_diagnosis,
          date_of_referral: visit.seva_referral_date,
          notes: visit.seva_notes
        } : null,
        
        physiotherapy: visit.physio_id ? {
          notes: visit.physio_notes,
          painpoints: painpoints
        } : null,
        
        consultation: visit.consultation_id ? {
          notes: visit.consultation_notes,
          prescription: visit.prescription,
          require_referral: visit.require_referral
        } : null,
        
        // Referrals are now at visit level, not nested in consultation
        referrals: referrals
      };
  
      // Generate ETag based on visit last_updated_at
      const etag = `"${visit.visit_last_updated}"`;
      
      // Check if client has cached version
      if (ifNoneMatch && ifNoneMatch === etag) {
        return res.status(304).end();
      }
  
      res.setHeader('ETag', etag);
      res.status(200).json(response);
    } catch (err) {
      console.error('Error fetching visit data:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

module.exports = router;