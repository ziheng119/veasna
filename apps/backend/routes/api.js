// routes/api.js

const express = require('express');
const router = express.Router();
const { authorizeApi } = require('../middleware/authorizeApi');
router.use(authorizeApi);

const sessionRoutes = require('./session');
const patientRoutes = require('./patient');
const patientsRoutes = require('./patients');
const registrationRoutes = require('./registration');
const queueRoutes = require('./queue');
const visitRoutes = require('./visits');
const visitEditRoutes = require('./visitEdits');
const pharmacyRoutes = require('./pharmacy');
const prescriptionRoutes = require('./prescriptions');
const triageRoutes = require('./triage');
const tbRoutes = require('./tb');
const familyRoutes = require('./family');
const analyticsRoutes = require('./analytics');
const accountRoutes = require('./accounts');
const formOptionRoutes = require('./formOptions');
const exportRoutes = require('./export');

router.use('/auth', sessionRoutes);
router.use('/registration', registrationRoutes);
router.use('/queue', queueRoutes);
router.use('/visits', visitRoutes);
// Corrections to saved visits (details, vitals/HEF, TB record): any account, within its day (utils/dayScope.js).
router.use('/visits', visitEditRoutes);
router.use('/pharmacy', pharmacyRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/triage', triageRoutes);
router.use('/tb', tbRoutes);
router.use('/family', familyRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/accounts', accountRoutes);
router.use('/form-options', formOptionRoutes);
router.use('/export', exportRoutes);
router.use('/patient', patientRoutes);
router.use('/patients', patientsRoutes);

module.exports = router;
