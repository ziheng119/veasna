-- Migration: families. Patients who come together share a letter, patients.family (A, B, ... Z,
-- AA, ...), per location; queue numbers stay plain (3, 4, 5). A family always has at least two
-- members, and a letter freed up is used again. Members waiting at the same station on the same day
-- move on together: one who is done there is marked visit_stations.family_ready_at and waits for the
-- rest (routes/queue.js, utils/familyMoves.js). Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/019_families.sql

ALTER TABLE patients ADD COLUMN IF NOT EXISTS family TEXT;
ALTER TABLE visit_stations ADD COLUMN IF NOT EXISTS family_ready_at TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patients_family_check') THEN
        ALTER TABLE patients ADD CONSTRAINT patients_family_check CHECK (family ~ '^[A-Z]{1,4}$');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS patients_family_idx ON patients (location_id, family) WHERE family IS NOT NULL;

-- A development version kept the family on each visit; it was never released, so it is dropped.
DROP INDEX IF EXISTS visits_family_idx;
ALTER TABLE visits DROP COLUMN IF EXISTS family;
