const db = require('../config/db');
const { authenticateToken } = require('../routes/auth');
const { canAccessApi, normalizeRole } = require('../utils/permissions');

// Mounted before every /api route. Never trust a role sent in the body or an old JWT.
function authorizeApi(req, res, next) {
  if (req.method === 'POST' && /^\/auth\/login\/?$/.test(req.path)) return next();
  authenticateToken(req, res, async () => {
    try {
      const { rows } = await db.query('SELECT id, username, role, is_active FROM users WHERE id=$1', [req.user.id]);
      const account = rows[0];
      if (!account?.is_active) return res.status(403).json({ message: 'Account inactive or unavailable' });
      req.user = { ...req.user, id: account.id, username: account.username, role: normalizeRole(account.role) };
      req.databaseAuthenticated = true;
      if (!canAccessApi(account.role, req.method, req.path)) {
        return res.status(403).json({ message: 'Your role does not have permission for this action' });
      }
      next();
    } catch (error) {
      console.error('Permission lookup failed:', error);
      res.status(503).json({ message: 'Unable to verify account permissions. Please try again.' });
    }
  });
}
module.exports = { authorizeApi };
