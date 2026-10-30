require('dotenv').config();
require('./middleware/asyncErrors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const { createServer } = require('http');
const db = require('./config/db');
const { parseOrigins, createOriginCheck, lanAddresses } = require('./config/network');
const { attachRealtime, notifyListChanges } = require('./realtime');

const app = express();
app.set("etag", "strong");
const PORT = process.env.PORT || 3000;
const origins = parseOrigins(process.env.NEXT_PUBLIC_FRONTEND_URL);
const allowLanOrigins = process.env.ALLOW_LAN_ORIGINS === 'true';
const isAllowedOrigin = createOriginCheck({ origins, allowLan: allowLanOrigins });
const server = createServer(app);
const io = attachRealtime(server, { origins: isAllowedOrigin, secret: process.env.JWT_SECRET });

// Security middleware
app.use(helmet());

// CORS configuration (same origin rules as the Socket.IO live-update channel)
app.use(cors({
  origin: (origin, done) => done(null, isAllowedOrigin(origin)),
  credentials: true
}));

// Rate limiting. Each saved write makes every connected device reload its lists, so
// the per-device budget must cover that background traffic on a busy clinic day.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.API_RATE_LIMIT_MAX) || 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

const createAuthRateLimit = require('./middleware/authRateLimit');
app.use('/api/auth/', createAuthRateLimit());

// Body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API routes
const apiRoutes = require('./routes/api');
app.use('/api', notifyListChanges(io), apiRoutes);

// Health check: reports database reachability so a client device can verify the
// whole path (LAN -> backend -> PostgreSQL) with one request.
app.get('/health', async (req, res) => {
  let database = 'ok';
  try {
    await db.query('SELECT 1');
  } catch {
    database = 'unreachable';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'OK' : 'DEGRADED',
    database,
    realtimeClients: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// PostgreSQL errors caused by the request's values rather than the server.
const CLIENT_DB_ERRORS = {
  '22P02': 'Invalid value in request', // e.g. text where a number is expected
  '22003': 'Number out of range',
  '22001': 'Value too long',
  '22007': 'Invalid date',
  '22008': 'Invalid date',
  '23503': 'A referenced record does not exist (it may have been deleted on another device)',
};

// Global error handler. Route handlers answer their own expected errors; this covers
// body parsing and errors forwarded from async handlers (middleware/asyncErrors.js).
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }
  if (CLIENT_DB_ERRORS[err.code]) {
    return res.status(400).json({ message: CLIENT_DB_ERRORS[err.code] });
  }
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Schema checks, in dependency order. Each is idempotent; a failure is logged and the
// remaining steps still run, matching earlier startup behaviour.
const { ensurePasswordColumn } = require('./routes/session');
const schema = require('./utils/ensureSchema');
const SCHEMA_STEPS = [
  ensurePasswordColumn,
  schema.ensurePharmacyNumericStock,
  schema.ensureVisitsCompleted,
  schema.ensureUserRole,
  schema.ensureVisitStations,
  schema.ensureSnellenFractions,
  schema.ensurePartialStationForms,
  schema.ensureGeneratedFaceId,
  schema.ensureSevaReferral,
  schema.ensureTbScreening,
  schema.ensureStationRouteHistory,
  schema.ensureConsultationConditions,
  schema.ensureReferralSignature,
];

// A standalone host may start this service before PostgreSQL is accepting connections.
async function waitForDatabase({ attempts = 30, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await db.query('SELECT 1');
      return true;
    } catch (err) {
      console.warn(`Database not reachable (${err.message}); retry ${attempt}/${attempts} in ${delayMs / 1000}s`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

async function start() {
  if (!process.env.JWT_SECRET) console.error('JWT_SECRET is not set: logins and live updates will fail.');

  if (await waitForDatabase()) {
    for (const step of SCHEMA_STEPS) {
      await step().catch(err => console.error(`Migration warning (${step.name}):`, err.message));
    }
  } else {
    // Still listen, so clients get a clear 503 from /health instead of connection refused.
    console.error('Database unreachable; starting without schema checks. Restart once PostgreSQL is running.');
  }

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '0.0.0.0', resolve);
  });
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  console.log(`Server listening on port ${PORT} (all interfaces)`);
  console.log(`  This host: http://localhost:${PORT}/health`);
  for (const address of lanAddresses()) console.log(`  LAN:       http://${address}:${PORT}/health`);
  console.log(`Allowed frontend origins: ${origins.join(', ')}` +
    (allowLanOrigins ? ' (plus any private-network origin)' : ''));
}

// Stop accepting connections and release database clients before exiting.
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 5000).unref();
  io.close(() => db.pool.end().finally(() => process.exit(0)));
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Listen only when run directly (nodemon/node server.js) or via start(); tests import app.
function run() {
  start().catch(err => {
    console.error(err.code === 'EADDRINUSE'
      ? `Port ${PORT} is already in use. Stop the other backend instance or change PORT.`
      : `Backend failed to start: ${err.message}`);
    process.exit(1);
  });
}

if (require.main === module) run();

module.exports = app;
module.exports.run = run;
