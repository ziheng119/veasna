const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Notifications invalidate lists; patient data stays behind the existing REST API.
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

function notifyListChanges(io) {
  return (req, res, next) => {
    const writes = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const affectsLists = /^\/(registration|patients|patient|visits|queue|triage|tb|prescriptions|pharmacy)(\/|$)/.test(req.path);
    if (writes.includes(req.method) && affectsLists) {
      // Routes send success only after their database writes/transactions complete.
      res.once('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          for (const socket of io.sockets.sockets.values()) {
            if (Date.now() < socket.data.expiresAt) socket.emit('lists:changed');
          }
        }
      });
    }
    next();
  };
}

module.exports = { attachRealtime, notifyListChanges };
