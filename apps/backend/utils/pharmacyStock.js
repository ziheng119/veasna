// utils/pharmacyStock.js
// Stock reserved by pending prescriptions. stock_count is what is physically on the shelf;
// available = stock_count - reserved is what can still be prescribed or dispensed.

// SQL expression for a pharmacy row aliased `p`.
const RESERVED_SQL = `(SELECT COALESCE(SUM(pr.quantity), 0)::int FROM prescriptions pr
                      WHERE pr.drug_id = p.id AND pr.status = 'pending')`;

// Locks the drug row until the transaction ends and returns it with its reserved and available
// counts, or null if it does not exist. Every change to stock or reservations takes this lock
// first, so two devices cannot both use the last units.
async function lockDrug(client, drugId) {
  const drug = await client.query('SELECT * FROM pharmacy WHERE id = $1 FOR UPDATE', [drugId]);
  if (!drug.rows.length) return null;
  // A separate statement, so it sees reservations committed while this one waited for the lock.
  const reserved = await client.query(
    `SELECT COALESCE(SUM(quantity), 0)::int AS reserved FROM prescriptions WHERE drug_id = $1 AND status = 'pending'`,
    [drugId]
  );
  const row = drug.rows[0];
  const reservedCount = reserved.rows[0].reserved;
  return { ...row, reserved_count: reservedCount, available_count: row.stock_count - reservedCount };
}

module.exports = { RESERVED_SQL, lockDrug };
