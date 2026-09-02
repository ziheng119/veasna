require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

const app = express();
app.set("etag", "strong");
const PORT = process.env.PORT || 3000;

// Treat these as "offline/LAN" deployments where abuse is not the threat model.
const OFFLINE_MODE = process.env.OFFLINE_MODE === 'true';

// Security middleware
app.use(helmet());

// CORS configuration.
// LAN-first deployment: clients reach the app via the host's LAN IP, not
// localhost, so a single hard-coded origin blocks every other device. By
// default we reflect the request origin (safe on a trusted private network).
// Set CORS_ALLOWED_ORIGINS (comma-separated) to restrict it.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true
}));

// Rate limiting.
// Keyed by client IP. With clients on the LAN each device has its own source
// IP, so the buckets are per-device. The general limiter is skipped in
// OFFLINE_MODE; the auth limiter always applies so an accidental retry loop
// can't flood the (openly registerable) users table.
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX) || 1000;
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX) || 100;

if (!OFFLINE_MODE) {
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: apiRateLimitMax,
    message: 'Too many requests from this IP, please try again later.'
  }));
}

app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authRateLimitMax,
  message: 'Too many authentication attempts, please try again later.'
}));

// Body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Run schema migrations at startup
const { ensurePasswordColumn } = require('./routes/session');
const {
  ensurePharmacyNumericStock,
  ensureVisitsCompleted,
  ensureQueueNumberUnique,
} = require('./utils/ensureSchema');
ensurePasswordColumn().catch(err => console.error('Migration warning:', err.message));
ensurePharmacyNumericStock().catch(err => console.error('Migration warning:', err.message));
ensureVisitsCompleted().catch(err => console.error('Migration warning:', err.message));

// This one is not best-effort: if we cannot guarantee unique queue numbers,
// two patients could silently share one. Fail startup rather than run without it.
ensureQueueNumberUnique().catch(err => {
  console.error('FATAL: could not enforce queue-number uniqueness.\n' + err.message);
  if (process.env.NODE_ENV !== 'test') process.exit(1);
});

// API routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

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

// Only start the HTTP listener when run directly (`node server.js`).
// Under `npm test` the app is imported by supertest and must not bind a port.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;
