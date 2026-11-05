-- Migration: families are their own letter on the visit, not part of the queue number.
-- A family keeps plain queue numbers (3, 4, 5) and shares visits.family ('A'). Members waiting at the
-- same station move on together: one who is done there is marked family_ready_at and waits for the
-- rest (routes/queue.js, utils/familyMoves.js). Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/019_visit_families.sql

ALTER TABLE visits ADD COLUMN IF NOT EXISTS family TEXT;
ALTER TABLE visit_stations ADD COLUMN IF NOT EXISTS family_ready_at TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visits_family_check') THEN
        ALTER TABLE visits ADD CONSTRAINT visits_family_check CHECK (family ~ '^[A-Z]{1,3}$');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS visits_family_idx ON visits (location_id, visit_date, family) WHERE family IS NOT NULL;

-- Numbers grouped the old way ("3A") become 3 in family A, unless the plain number is already used
-- that day (an older typed number), in which case the visit is left as it was.
UPDATE visits v
SET family = substring(v.queue_no FROM '[A-Z]+$'),
    queue_no = substring(v.queue_no FROM '^[0-9]+')
WHERE v.family IS NULL
  AND v.queue_no ~ '^[0-9]+[A-Z]{1,3}$'
  AND NOT EXISTS (
      SELECT 1 FROM visits o
      WHERE o.id <> v.id AND o.location_id = v.location_id AND o.visit_date = v.visit_date
        AND UPPER(o.queue_no) = substring(v.queue_no FROM '^[0-9]+')
  );
