const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
const { toPositiveInt } = require('./utils/validation');

// Notifications invalidate lists and open forms; patient data stays behind the existing REST API.
// `origins` is either an exact list or the (origin) => boolean check used for REST CORS.
function attachRealtime(server, { origins, secret }) {
  const isAllowed = typeof origins === 'function' ? origins : origin => !origin || origins.includes(origin);
  const io = new Server(server, {
    cors: { origin: (origin, done) => done(null, isAllowed(origin)), credentials: true },
    allowRequest: (req, done) => done(null, isAllowed(req.headers.origin)),
    maxHttpBufferSize: 16 * 1024,
  });

  io.use((socket, next) => {
    try {
      const user = jwt.verify(socket.handshake.auth.token, secret, { algorithms: ['HS256'] });
      if (!user || typeof user !== 'object' || !user.id || !user.exp) throw new Error('Invalid token');
      socket.data.expiresAt = user.exp * 1000;
      // The location the device works at: it is told only about changes there (null: all).
      socket.data.locationId = toPositiveInt(socket.handshake.auth.locationId);
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    // Recheck long sessions, without overflowing Node's maximum timeout.
    const expiry = setInterval(() => {
      if (Date.now() >= socket.data.expiresAt) socket.disconnect(true);
    }, 1000);
    expiry.unref();
    socket.on('disconnect', () => clearInterval(expiry));
  });

  return io;
}

// The visit a write changed, when its address or body names one: open forms for that visit reload
// and show what was saved (apps/frontend/src/components/shared/LiveRecord.tsx). null when it can't be
// told from the request (e.g. a patient's details, dispensing by prescription id); clients then
// treat any open visit as possibly changed. Only the id is sent, never patient data.
const VISIT_IN_PATH = [
  /^\/queue\/(\d+)\//,
  /^\/tb\/(\d+)\//,
  /^\/visits\/(?:dental|seva|physiotherapy|consultation|referral)\/(\d+)$/,
  /^\/visits\/(\d+)(?:\/(?:vitals|tb))?$/,
];
function changedVisitId(req) {
  const path = req.path.replace(/\/+$/, '');
  for (const pattern of VISIT_IN_PATH) {
    const match = pattern.exec(path);
    if (match) return Number(match[1]);
  }
  if (/^\/(triage\/[a-z-]+|prescriptions)$/.test(path) && req.method === 'POST') {
    const id = Number(req.body?.visit_id);
    if (Number.isSafeInteger(id) && id > 0) return id;
  }
  return null;
}

// The location a write changed: the visit's, or a location_id in the body (registration sends
// patientInfo.location_id). null when it can't be told, and then every device is told.
async function changedLocationId(req, visitId) {
  if (visitId) {
    try {
      const { rows } = await db.query('SELECT location_id FROM visits WHERE id = $1', [visitId]);
      return toPositiveInt(rows[0]?.location_id);
    } catch {
      return null;
    }
  }
  return toPositiveInt(req.body?.location_id ?? req.body?.patientInfo?.location_id);
}

function notifyListChanges(io) {
  return (req, res, next) => {
    const writes = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const affectsLists = /^\/(registration|patients|patient|visits|queue|triage|tb|prescriptions|pharmacy|family)(\/|$)/.test(req.path);
    if (writes.includes(req.method) && affectsLists) {
      // Routes send success only after their database writes/transactions complete.
      const visitId = changedVisitId(req);
      res.once('finish', async () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        const locationId = await changedLocationId(req, visitId);
        for (const socket of io.sockets.sockets.values()) {
          const there = !locationId || !socket.data.locationId || socket.data.locationId === locationId;
          if (there && Date.now() < socket.data.expiresAt) socket.emit('lists:changed', { visitId });
        }
      });
    }
    next();
  };
}

module.exports = { attachRealtime, notifyListChanges, changedVisitId };
