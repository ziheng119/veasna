// routes/accounts.js
// Admin-only (utils/permissions.js): the sign-in accounts, and screening-day accounts such as
// dec13village, which every volunteer shares on that day (utils/dayScope.js).
//   GET    /api/accounts      every account
//   POST   /api/accounts      { username, password, screening_date, permissions? } creates a screening-day
//                              account; permissions defaults to see today's patients and edit the queue
//   PUT    /api/accounts/:id  { password?, screening_date?, is_active?, permissions? } changes one
//   DELETE /api/accounts/:id  removes a screening-day account; one that entered records is disabled
// The admin account is reset with `npm run setup:accounts`, never changed here, so an admin cannot
// lock everyone out. The old shared "user" account is disabled (migration 022).
const express = require('express');
const router = express.Router();
const { integerParams, isIsoDate } = require('../utils/validation');
integerParams(router, ['id']);
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');
const { DEFAULT_PERMISSIONS, normalizePermissions } = require('../utils/permissions');

const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/i;
const MIN_PASSWORD = 4;
const ACCOUNT_FIELDS = `id, username, role, is_active, TO_CHAR(screening_date, 'YYYY-MM-DD') AS screening_date,
  permissions, created_at, last_updated_at`;
const SELECT_ACCOUNT = `SELECT ${ACCOUNT_FIELDS} FROM users`;
const PERMISSIONS_ERROR = 'permissions must be a list of permission names.';

const adminOnly = [authenticateToken, requireRole(['admin'])];

function passwordError(password) {
  return typeof password !== 'string' || password.length < MIN_PASSWORD
    ? `The password needs at least ${MIN_PASSWORD} characters.` : null;
}

router.get('/', ...adminOnly, async (_req, res) => {
  const { rows } = await db.query(`${SELECT_ACCOUNT} ORDER BY screening_date DESC NULLS FIRST, LOWER(username)`);
  res.setHeader('Cache-Control', 'no-store');
  res.json(rows);
});

router.post('/', ...adminOnly, async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const { password, screening_date: screeningDate } = req.body;
  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({ error: 'Usernames are 3 to 40 letters, numbers, dots, dashes or underscores, without spaces.' });
  }
  const badPassword = passwordError(password);
  if (badPassword) return res.status(400).json({ error: badPassword });
  if (!isIsoDate(screeningDate)) return res.status(400).json({ error: 'Choose the screening date.' });
  const permissions = req.body.permissions === undefined ? DEFAULT_PERMISSIONS : normalizePermissions(req.body.permissions);
  if (!permissions) return res.status(400).json({ error: PERMISSIONS_ERROR });
  const hash = await db.hashPassword(password);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (username, password_hash, role, is_active, screening_date, permissions, last_updated_by)
       VALUES ($1, $2, 'user', TRUE, $3, $4::text[], $5)
       RETURNING ${ACCOUNT_FIELDS}`,
      [username, hash, screeningDate, permissions, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: `The username "${username}" is already taken.` });
    throw error;
  }
});

// Only screening-day accounts can be changed or removed here.
async function findDayAccount(id) {
  const { rows } = await db.query(`${SELECT_ACCOUNT} WHERE id = $1`, [id]);
  return rows[0]?.screening_date ? rows[0] : null;
}

router.put('/:id', ...adminOnly, async (req, res) => {
  const account = await findDayAccount(req.params.id);
  if (!account) return res.status(404).json({ error: 'Screening-day account not found.' });
  const { password, screening_date: screeningDate, is_active: isActive } = req.body;
  const permissions = req.body.permissions === undefined ? null : normalizePermissions(req.body.permissions);
  if (req.body.permissions !== undefined && !permissions) return res.status(400).json({ error: PERMISSIONS_ERROR });
  if (password !== undefined && passwordError(password)) return res.status(400).json({ error: passwordError(password) });
  if (screeningDate !== undefined && !isIsoDate(screeningDate)) return res.status(400).json({ error: 'Choose the screening date.' });
  if (isActive !== undefined && typeof isActive !== 'boolean') return res.status(400).json({ error: 'is_active must be true or false.' });
  const hash = password === undefined ? null : await db.hashPassword(password);
  const { rows } = await db.query(
    `UPDATE users SET
       password_hash = COALESCE($2, password_hash),
       screening_date = COALESCE($3::date, screening_date),
       is_active = COALESCE($4, is_active),
       permissions = COALESCE($6::text[], permissions),
       last_updated_by = $5, last_updated_at = NOW()
     WHERE id = $1
     RETURNING ${ACCOUNT_FIELDS}`,
    [account.id, hash, screeningDate ?? null, isActive ?? null, req.user.id, permissions]
  );
  res.json(rows[0]);
});

// Records keep who entered them, so an account that saved anything is disabled instead of removed.
router.delete('/:id', ...adminOnly, async (req, res) => {
  const account = await findDayAccount(req.params.id);
  if (!account) return res.status(404).json({ error: 'Screening-day account not found.' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SAVEPOINT remove_account');
    try {
      await client.query('DELETE FROM users WHERE id = $1', [account.id]);
      await client.query('COMMIT');
      return res.json({ id: account.id, deleted: true });
    } catch (error) {
      if (error.code !== '23503') throw error;
      await client.query('ROLLBACK TO SAVEPOINT remove_account');
      await client.query('UPDATE users SET is_active = FALSE, last_updated_by = $2, last_updated_at = NOW() WHERE id = $1',
        [account.id, req.user.id]);
      await client.query('COMMIT');
      return res.json({ id: account.id, deleted: false, disabled: true });
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

module.exports = router;
