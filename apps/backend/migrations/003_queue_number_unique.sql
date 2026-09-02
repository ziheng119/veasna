-- Migration: one queue number per location per day among visits still in the
-- queue. A discharged (completed) visit frees its number for reuse the same day.
-- Idempotent. Fails loudly (does NOT skip) if active visits already collide.
-- Run: psql -U <user> -d <database> -f migrations/003_queue_number_unique.sql

DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(
           format('  location_id=%s  visit_date=%s  queue_no=%L  (%s visits)',
                  location_id, visit_date, queue_no, cnt),
           E'\n')
    INTO dupes
    FROM (
      SELECT location_id, visit_date, queue_no, count(*) AS cnt
        FROM visits
       WHERE completed_at IS NULL
       GROUP BY location_id, visit_date, queue_no
      HAVING count(*) > 1
    ) d;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION E'Active visits already share a queue number, so the unique index cannot be created:\n%\n\nList the affected visits and renumber (or discharge) the duplicates:\n  SELECT id, patient_id, location_id, visit_date, queue_no, created_at\n    FROM visits\n   WHERE completed_at IS NULL\n   ORDER BY location_id, visit_date, queue_no, created_at;\n\nThen re-run this migration.', dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS visits_active_queue_no_unique
  ON visits (location_id, visit_date, queue_no)
  WHERE completed_at IS NULL;
