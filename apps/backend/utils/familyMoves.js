// utils/familyMoves.js
// A family (patients.family) moves between stations as a unit: when one member is sent on (Finish,
// Send to, or a TB flag sending them to Consult), the members waiting with them go too
// (moveFamilyAlong). While a member flagged for TB waits at Consult, the family there stays with
// them until the flag is cleared (tbFamilyHold). family_ready_at marks members of older visits who were done and waiting for
// the rest of the family (releaseFamily). See docs/station-routing.md.
const { DOCTOR_ADDED_STATIONS } = require('./stations');
const { isTbVisit, TB_FLAGGED_STATUSES } = require('./tb');

const FAMILY_LOCK_NAMESPACE = 7102;

// Serializes family changes and station moves until the transaction ends. Take it before any visit
// or patient row lock, so moving a family (which locks every member) can't deadlock.
function lockFamilies(client) {
  return client.query('SELECT pg_advisory_xact_lock($1, 0)', [FAMILY_LOCK_NAMESPACE]);
}

// Whether the visit exists, read before taking any lock.
async function visitExists(client, visitId) {
  const { rows } = await client.query('SELECT 1 FROM visits WHERE id = $1', [visitId]);
  return rows.length > 0;
}

// Finishes the visit's current station: the next one starts, or the visit is complete when there
// is none. Returns the next station, or null.
async function advanceVisit(client, visitId, userId) {
  const { rows: pending } = await client.query(
    'SELECT id, station FROM visit_stations WHERE visit_id = $1 AND completed_at IS NULL ORDER BY position',
    [visitId]
  );
  if (!pending.length) return null;
  await client.query(
    'UPDATE visit_stations SET completed_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2',
    [userId, pending[0].id]
  );
  const next = pending[1] || null;
  if (next) {
    await client.query(
      'UPDATE visit_stations SET entered_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2',
      [userId, next.id]
    );
  } else {
    await client.query(
      'UPDATE visits SET completed_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2',
      [userId, visitId]
    );
  }
  return next ? next.station : null;
}

// The family's open visits on a day, with their current station, locked. The caller holds
// lockFamilies.
async function familyMembers(client, place, family) {
  const params = [place.visit_date, family];
  const where = `v.visit_date = $1::date AND p.family = $2 AND v.completed_at IS NULL`;
  await client.query(`SELECT v.id FROM visits v JOIN patients p ON p.id = v.patient_id WHERE ${where} ORDER BY v.id FOR UPDATE OF v`, params);
  const { rows } = await client.query(
    `SELECT v.id AS visit_id, v.queue_no, p.english_name, cur.station, cur.family_ready_at IS NOT NULL AS ready,
            EXISTS (SELECT 1 FROM tb_screening tb WHERE tb.visit_id = v.id AND tb.status = ANY($3::text[])) AS tb_flagged
     FROM visits v
     JOIN patients p ON p.id = v.patient_id
     JOIN LATERAL (
         SELECT s.station, s.family_ready_at FROM visit_stations s
         WHERE s.visit_id = v.id AND s.completed_at IS NULL ORDER BY s.position LIMIT 1
     ) cur ON TRUE
     WHERE ${where}
     ORDER BY v.id`,
    [...params, TB_FLAGGED_STATUSES]
  );
  return rows;
}

// Moves on every group of family members who are all done at the station they wait at.
// place gives the day ({ visit_date }). Returns
// { moved: [{ visit_id, queue_no, completed_station, next_station }], members } where members are
// the family's open visits there before the move.
async function releaseFamily(client, place, family, userId) {
  if (!family) return { moved: [], members: [] };
  const members = await familyMembers(client, place, family);
  const moved = [];
  for (const station of new Set(members.map((member) => member.station))) {
    const here = members.filter((member) => member.station === station);
    if (!here.every((member) => member.ready)) continue;
    for (const member of here) {
      const next = await advanceVisit(client, member.visit_id, userId);
      moved.push({ visit_id: member.visit_id, queue_no: member.queue_no, completed_station: station, next_station: next });
    }
  }
  return { moved, members };
}

// After a patient's family changed (joined, left, or the family was dissolved), lets their open
// visits move on if no one is left to wait for: with the family's other members, or alone.
async function releasePatient(client, patientId, userId) {
  const { rows } = await client.query(
    `SELECT v.id, TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, p.family
     FROM visits v JOIN patients p ON p.id = v.patient_id
     WHERE v.patient_id = $1 AND v.completed_at IS NULL`,
    [patientId]
  );
  for (const visit of rows) {
    if (visit.family) {
      await releaseFamily(client, visit, visit.family, userId);
      continue;
    }
    const { rows: current } = await client.query(
      'SELECT family_ready_at FROM visit_stations WHERE visit_id = $1 AND completed_at IS NULL ORDER BY position LIMIT 1',
      [visit.id]
    );
    if (current.length && current[0].family_ready_at) await advanceVisit(client, visit.id, userId);
  }
}

// After a visit left the station its family waits at (e.g. a TB flag sent it to Consultation), lets
// the members waiting there move on. The caller holds lockFamilies.
async function releaseVisitFamily(client, visitId, userId) {
  const { rows } = await client.query(
    `SELECT TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, p.family
     FROM visits v JOIN patients p ON p.id = v.patient_id WHERE v.id = $1`,
    [visitId]
  );
  if (rows.length) await releaseFamily(client, rows[0], rows[0].family, userId);
}

// Sends the visit's family members along with it, so the family stays together: every member open
// that day at station `from` (at any station when from is null) goes to `to` as well. Their station
// `from` is finished (leave 'finish'), kept for after `to` ('keep') or taken off their route
// ('drop'), as the patient's was. When finishing with `to` null (the patient has no stations left),
// or `to` is a station only the doctor adds (Physiotherapy, Pharmacy) that a member doesn't have,
// that member moves on to their own next station. Visits ever flagged for TB keep their fixed route:
// a cleared one is finished with the family and moves on along its own route; a flagged one is
// left alone. The caller holds lockFamilies. Returns [{ visit_id, queue_no, next_station }].
async function moveFamilyAlong(client, visitId, { from, to, leave }, userId) {
  const { rows } = await client.query(
    `SELECT TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, p.family
     FROM visits v JOIN patients p ON p.id = v.patient_id WHERE v.id = $1`,
    [visitId]
  );
  if (!rows[0]?.family) return [];
  const members = (await familyMembers(client, rows[0], rows[0].family))
    .filter((member) => member.visit_id !== visitId && (from === null || member.station === from) && member.station !== to);
  const moved = [];
  for (const member of members) {
    const tb = await isTbVisit(client, member.visit_id);
    if (tb && member.tb_flagged) continue;
    const { rows: route } = await client.query('SELECT * FROM visit_stations WHERE visit_id = $1 ORDER BY position, id', [member.visit_id]);
    if (tb || !to || (DOCTOR_ADDED_STATIONS.includes(to) && !route.some((row) => row.station === to))) {
      if (leave !== 'finish') continue;
      moved.push({ visit_id: member.visit_id, queue_no: member.queue_no, next_station: await advanceVisit(client, member.visit_id, userId) });
      continue;
    }
    const [here, ...rest] = route.filter((row) => !row.completed_at);
    const wanted = [to, ...(leave === 'keep' ? [here.station] : []), ...rest.map((row) => row.station).filter((station) => station !== to)];
    await client.query(
      'INSERT INTO visit_station_route_history (visit_id, previous_stations, requested_stations, last_updated_by) VALUES ($1, $2::jsonb, $3::jsonb, $4)',
      [member.visit_id, JSON.stringify(route), JSON.stringify(wanted), userId]
    );
    if (leave === 'finish') {
      await client.query('UPDATE visit_stations SET completed_at = NOW(), last_updated_by = $1, last_updated_at = NOW() WHERE id = $2', [userId, here.id]);
    } else if (leave === 'drop') {
      await client.query('DELETE FROM visit_stations WHERE id = $1', [here.id]);
    }
    // Positions are rewritten in route order: `to` starts now, a reopened station starts afresh.
    for (const [index, station] of wanted.entries()) {
      await client.query(
        `INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
         VALUES ($1, $2, $3, CASE WHEN $4 THEN NOW() END, $5)
         ON CONFLICT (visit_id, station) DO UPDATE SET
            position = EXCLUDED.position, entered_at = EXCLUDED.entered_at, completed_at = NULL, family_ready_at = NULL,
            last_updated_by = EXCLUDED.last_updated_by, last_updated_at = NOW()`,
        [member.visit_id, station, index + 1, index === 0, userId]
      );
    }
    await client.query('UPDATE visits SET last_updated_by = $2, last_updated_at = NOW() WHERE id = $1', [member.visit_id, userId]);
    moved.push({ visit_id: member.visit_id, queue_no: member.queue_no, next_station: to });
  }
  return moved;
}

// While a family member flagged for TB waits at Consult, the rest of the family waiting there stays
// with them: they are not finished or sent on from Consult until the doctor clears the flag, and
// then they all move on together. Returns the refusal message for the visit, or null. The caller
// holds lockFamilies.
async function tbFamilyHold(client, visitId) {
  const { rows } = await client.query(
    `SELECT TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, p.family
     FROM visits v JOIN patients p ON p.id = v.patient_id WHERE v.id = $1`,
    [visitId]
  );
  if (!rows[0]?.family) return null;
  const members = await familyMembers(client, rows[0], rows[0].family);
  if (members.find((member) => member.visit_id === visitId)?.station !== 'consultation') return null;
  const flagged = members.filter((member) => member.visit_id !== visitId && member.tb_flagged && member.station === 'consultation');
  if (!flagged.length) return null;
  const names = flagged.map((member) => `${member.queue_no}${member.english_name ? ` ${member.english_name}` : ''}`).join(', ');
  return `Family member ${names} is flagged for suspected TB. The family stays at Consult together until the doctor clears the flag.`;
}

module.exports = { lockFamilies, visitExists, advanceVisit, releaseFamily, releasePatient, releaseVisitFamily, moveFamilyAlong, tbFamilyHold };
