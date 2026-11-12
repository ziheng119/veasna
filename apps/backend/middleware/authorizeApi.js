const db = require('../config/db');
const { authenticateToken } = require('../routes/auth');
const { missingPermission, permissionMessage, normalizeRole, permissionsFor } = require('../utils/permissions');
const { checkDayScope, scopeDate, screeningDayEnded, screeningDayEndedMessage } = require('../utils/dayScope');

// Mounted before every /api route. Never trust a role sent in the body or an old JWT.
function authorizeApi(req, res, next) {
  if (req.method === 'POST' && /^\/auth\/login\/?$/.test(req.path)) return next();
  authenticateToken(req, res, async () => {
    try {
      const { rows } = await db.query(
        `SELECT id, username, role, is_active, TO_CHAR(screening_date, 'YYYY-MM-DD') AS screening_date, permissions
         FROM users WHERE id=$1`, [req.user.id]);
      const account = rows[0];
      // 401: this sign-in no longer works, so the device signs out.
      if (!account?.is_active) return res.status(401).json({ message: 'This account has been disabled. Please sign in again.' });
      req.user = {
        ...req.user, id: account.id, username: account.username, role: normalizeRole(account.role),
        // Set for a screening-day account (utils/dayScope.js).
        screening_date: account.screening_date,
        // What the admin ticked for this account (every permission for the admin).
        permissions: permissionsFor(account.role, account.permissions),
      };
      // 401: the day this account was for is over, so the device signs out.
      if (screeningDayEnded(req.user)) return res.status(401).json({ message: screeningDayEndedMessage(req.user) });
      // The day whose patients this account sees in lists: null for every patient (the admin, or the
      // view_past permission), otherwise the screening date, or the host's clinic day without one.
      req.user.scope_date = scopeDate(req.user);
      req.databaseAuthenticated = true;
      const missing = missingPermission(account.role, account.permissions, req.method, req.path);
      if (missing) {
        const message = permissionMessage(missing);
        return res.status(403).json({ message, error: message, missing_permission: missing });
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
