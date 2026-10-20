require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const { createServer } = require('http');
const { attachRealtime, notifyListChanges } = require('./realtime');

const app = express();
app.set("etag", "strong");
const PORT = process.env.PORT || 3000;
const origins = (process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3001')
  .split(',').map(origin => origin.trim()).filter(Boolean);
const server = createServer(app);
const io = attachRealtime(server, { origins, secret: process.env.JWT_SECRET });

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: origins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts, please try again later.'
});
app.use('/api/auth/', authLimiter);

// Body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Run schema migrations at startup
const { ensurePasswordColumn } = require('./routes/session');
const { ensurePharmacyNumericStock, ensureVisitsCompleted, ensureUserRole, ensureVisitStations, ensureSnellenFractions, ensurePartialStationForms, ensureGeneratedFaceId, ensureSevaReferral, ensureTbScreening, ensureStationRouteHistory, ensureReferralSignature } = require('./utils/ensureSchema');
ensurePasswordColumn().catch(err => console.error('Migration warning:', err.message));
ensurePharmacyNumericStock().catch(err => console.error('Migration warning:', err.message));
ensureVisitsCompleted().catch(err => console.error('Migration warning:', err.message));
ensureUserRole().catch(err => console.error('Migration warning:', err.message));
ensureVisitStations().catch(err => console.error('Migration warning:', err.message));
ensureSnellenFractions().catch(err => console.error('Migration warning:', err.message));
ensurePartialStationForms().catch(err => console.error('Migration warning:', err.message));
ensureGeneratedFaceId().catch(err => console.error('Migration warning:', err.message));
ensureSevaReferral().catch(err => console.error('Migration warning:', err.message));
ensureTbScreening().catch(err => console.error('Migration warning:', err.message));
ensureStationRouteHistory().catch(err => console.error('Migration warning:', err.message));

ensureReferralSignature().catch(err => console.error('Migration warning:', err.message));

// API routes
const apiRoutes = require('./routes/api');
app.use('/api', notifyListChanges(io), apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// When using 'npm test' comment out this part
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
