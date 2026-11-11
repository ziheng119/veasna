// utils/familyMoves.js
// A family (patients.family) moves between stations together. A member who is done at a station is
// marked family_ready_at and waits there; once every member of the family waiting at that station
// that day is done, they all move on, each to their own next station. See docs/station-routing.md.

const FAMILY_LOCK_NAMESPACE = 7102;

// Serializes family changes and station moves at a location until the transaction ends. Take it
// before any visit or patient row lock, so moving a family (which locks every member) can't deadlock.
function lockFamilies(client, locationId) {
  return client.query('SELECT pg_advisory_xact_lock($1, $2)', [FAMILY_LOCK_NAMESPACE, locationId]);
}

// The visit's location, read before taking any lock; null when there is no such visit.
async function visitLocation(client, visitId) {
  const { rows } = await client.query('SELECT location_id FROM visits WHERE id = $1', [visitId]);
  return rows.length ? rows[0].location_id : null;
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

// The family's open visits at a location on a day, with their current station, locked. The caller
// holds lockFamilies.
async function familyMembers(client, place, family) {
  const params = [place.location_id, place.visit_date, family];
  const where = `v.location_id = $1 AND v.visit_date = $2::date AND p.family = $3 AND v.completed_at IS NULL`;
  await client.query(`SELECT v.id FROM visits v JOIN patients p ON p.id = v.patient_id WHERE ${where} ORDER BY v.id FOR UPDATE OF v`, params);
  const { rows } = await client.query(
    `SELECT v.id AS visit_id, v.queue_no, p.english_name, cur.station, cur.family_ready_at IS NOT NULL AS ready
     FROM visits v
     JOIN patients p ON p.id = v.patient_id
     JOIN LATERAL (
         SELECT s.station, s.family_ready_at FROM visit_stations s
         WHERE s.visit_id = v.id AND s.completed_at IS NULL ORDER BY s.position LIMIT 1
     ) cur ON TRUE
     WHERE ${where}
     ORDER BY v.id`,
    params
  );
  return rows;
}

// Moves on every group of family members who are all done at the station they wait at.
// place gives the location and day ({ location_id, visit_date }). Returns
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
    `SELECT v.id, v.location_id, TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, p.family
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
    `SELECT v.location_id, TO_CHAR(v.visit_date, 'YYYY-MM-DD') AS visit_date, p.family
     FROM visits v JOIN patients p ON p.id = v.patient_id WHERE v.id = $1`,
    [visitId]
  );
  if (rows.length) await releaseFamily(client, rows[0], rows[0].family, userId);
}

module.exports = { lockFamilies, visitLocation, advanceVisit, releaseFamily, releasePatient, releaseVisitFamily };
