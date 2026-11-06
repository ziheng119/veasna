// Choices offered in station forms that an admin can change on the Station data page. Each list is
// [{ id, label }] in display order (sticker colours also carry a colour, '#rrggbb'). Lists never changed use the defaults in shared/ (also used by the
// web app before it has loaded the saved lists). Saved records keep the ids/labels they were saved
// with, so renaming or removing a choice never changes earlier visits.
const db = require('../config/db');
const DEFAULTS_FILE = require('../../../shared/formOptions.json');
const CONDITIONS = require('../../../shared/consultationConditions.json');
const { normalizeSnellen } = require('./snellen');

// kind 'value': the label itself is what forms save (id = label).
// kind 'id': forms save the id, so a renamed choice keeps its id and earlier records keep matching.
const LISTS = {
  snellen: { kind: 'value', defaults: DEFAULTS_FILE.snellen },
  tb_red_flags: { kind: 'id', defaults: DEFAULTS_FILE.tb_red_flags },
  referral_destinations: { kind: 'value', defaults: DEFAULTS_FILE.referral_destinations },
  consultation_conditions: { kind: 'id', defaults: CONDITIONS },
  // Sticker given at registration; shown as a coloured tag on the patient in every queue.
  sticker_colours: { kind: 'id', defaults: DEFAULTS_FILE.sticker_colours },
};
const MAX_ITEMS = 50;
const MAX_LABEL = 100;

// Returns { items } with trimmed values, or { error } describing the first problem.
function validateItems(key, input) {
  const list = LISTS[key];
  if (!list) return { error: 'Unknown list' };
  if (!Array.isArray(input) || input.length === 0) return { error: 'Keep at least one choice.' };
  if (input.length > MAX_ITEMS) return { error: `A list can have at most ${MAX_ITEMS} choices.` };
  const items = [];
  for (const raw of input) {
    const label = typeof raw?.label === 'string' ? raw.label.trim().replace(/\s+/g, ' ') : '';
    if (!label) return { error: 'Every choice needs a name.' };
    if (label.length > MAX_LABEL) return { error: `Choice names can be at most ${MAX_LABEL} characters.` };
    if (key === 'referral_destinations' && label.includes('\n')) return { error: 'Choice names must be one line.' };
    let id = label;
    if (key === 'snellen') {
      id = normalizeSnellen(label);
      if (!id) return { error: `"${label}" is not a Snellen fraction such as 20/20 or 20/40.` };
    } else if (list.kind === 'id') {
      id = typeof raw.id === 'string' ? raw.id.trim() : '';
      if (!/^[a-z0-9_]{1,40}$/.test(id)) return { error: `Choice "${label}" has an invalid id.` };
    }
    if (key === 'sticker_colours') {
      const colour = typeof raw.colour === 'string' ? raw.colour.trim().toLowerCase() : '';
      if (!/^#[0-9a-f]{6}$/.test(colour)) return { error: `Choice "${label}" needs a colour such as #1f5fd1.` };
      items.push({ id, label, colour });
      continue;
    }
    items.push({ id, label: key === 'snellen' ? id : label });
  }
  if (new Set(items.map(item => item.id)).size !== items.length ||
      new Set(items.map(item => item.label.toLowerCase())).size !== items.length) {
    return { error: 'Each choice must appear only once.' };
  }
  return { items };
}

// Saved lists. Before migration 020 has run (the table is missing), forms keep the built-in choices.
async function savedRows(client, sql, params) {
  try {
    return (await client.query(sql, params)).rows;
  } catch (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
}

// Every list: { key: { items, customized, last_updated_at, last_updated_by } }.
async function getAllOptions(client = db) {
  const rows = await savedRows(client,
    `SELECT f.list_key, f.items, f.last_updated_at, u.username AS last_updated_by
     FROM form_options f LEFT JOIN users u ON u.id = f.last_updated_by`
  );
  const saved = Object.fromEntries(rows.map(row => [row.list_key, row]));
  return Object.fromEntries(Object.entries(LISTS).map(([key, list]) => {
    const row = saved[key];
    return [key, row
      ? { items: row.items, customized: true, last_updated_at: row.last_updated_at, last_updated_by: row.last_updated_by }
      : { items: list.defaults, customized: false, last_updated_at: null, last_updated_by: null }];
  }));
}

async function getOptions(key, client = db) {
  const rows = await savedRows(client, 'SELECT items FROM form_options WHERE list_key = $1', [key]);
  return rows[0]?.items ?? LISTS[key].defaults;
}

// A visit's sticker colour: blank means no sticker (null); otherwise the id of a choice on the
// current sticker_colours list. Returns { value } or { error }.
async function normalizeStickerColour(input, client = db) {
  if (input === undefined || input === null || input === '') return { value: null };
  const colours = await getOptions('sticker_colours', client);
  if (typeof input !== 'string' || !colours.some(colour => colour.id === input)) {
    return { error: `sticker_colour must be one of: ${colours.map(colour => colour.id).join(', ')}, or blank.` };
  }
  return { value: input };
}

module.exports = { LISTS, validateItems, getAllOptions, getOptions, normalizeStickerColour };
