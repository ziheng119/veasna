const db = require('../config/db');
const { authenticateToken } = require('../routes/auth');
const { canAccessApi, normalizeRole } = require('../utils/permissions');
const { checkDayScope, scopeDate } = require('../utils/dayScope');

// Mounted before every /api route. Never trust a role sent in the body or an old JWT.
function authorizeApi(req, res, next) {
  if (req.method === 'POST' && /^\/auth\/login\/?$/.test(req.path)) return next();
  authenticateToken(req, res, async () => {
    try {
      const { rows } = await db.query(
        `SELECT id, username, role, is_active, TO_CHAR(screening_date, 'YYYY-MM-DD') AS screening_date
         FROM users WHERE id=$1`, [req.user.id]);
      const account = rows[0];
      if (!account?.is_active) return res.status(403).json({ message: 'Account inactive or unavailable' });
      req.user = {
        ...req.user, id: account.id, username: account.username, role: normalizeRole(account.role),
        // Set for a screening-day account (utils/dayScope.js).
        screening_date: account.screening_date,
      };
      // The day whose patients this account may see: null for admins (every patient), otherwise the
      // screening date, or the host's clinic day for an account without one.
      req.user.scope_date = scopeDate(req.user);
      req.databaseAuthenticated = true;
      if (!canAccessApi(account.role, req.method, req.path)) {
        return res.status(403).json({ message: 'Your role does not have permission for this action' });
      }
      const outOfScope = await checkDayScope(db, req, req.path);
      if (outOfScope) return res.status(outOfScope.status).json({ message: outOfScope.message, error: outOfScope.message });
      next();
    } catch (error) {
      console.error('Permission lookup failed:', error);
      res.status(503).json({ message: 'Unable to verify account permissions. Please try again.' });
    }
  });
}
module.exports = { authorizeApi };
