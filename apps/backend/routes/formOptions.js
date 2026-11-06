// routes/formOptions.js
// Station form choices (utils/formOptions.js). Everyone reads them; only admins change them
// (utils/permissions.js refuses other roles before these handlers run).
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireRole } = require('./auth');
const { LISTS, validateItems, getAllOptions } = require('../utils/formOptions');

// GET /api/form-options - { snellen: { items, customized, last_updated_at, last_updated_by }, ... }
router.get('/', authenticateToken, async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await getAllOptions());
});

// PUT /api/form-options/:key - Body: { items: [{ id, label }] }. Replaces the list.
router.put('/:key', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { key } = req.params;
  if (!LISTS[key]) return res.status(404).json({ error: 'Unknown list' });
  const { items, error } = validateItems(key, req.body.items);
  if (error) return res.status(400).json({ error });
  await db.query(
    `INSERT INTO form_options (list_key, items, last_updated_by) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (list_key) DO UPDATE SET items = EXCLUDED.items,
       last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()`,
    [key, JSON.stringify(items), req.user.id]
  );
  res.json((await getAllOptions())[key]);
});

// DELETE /api/form-options/:key - Go back to the built-in choices.
router.delete('/:key', authenticateToken, requireRole(['admin']), async (req, res) => {
  const { key } = req.params;
  if (!LISTS[key]) return res.status(404).json({ error: 'Unknown list' });
  await db.query('DELETE FROM form_options WHERE list_key = $1', [key]);
  res.json((await getAllOptions())[key]);
});

module.exports = router;
