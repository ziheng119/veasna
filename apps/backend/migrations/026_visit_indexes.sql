-- Migration: indexes for the queue and patient lists, and one queue number per location and day.
-- Idempotent. Run: psql -U <user> -d <database> -f migrations/026_visit_indexes.sql
--
-- Every save makes every device reload its queue and Patient List, which look visits up by
-- location and date, and by patient. Without these indexes each reload reads the whole table.
CREATE INDEX IF NOT EXISTS visits_patient_idx ON visits (patient_id);

-- Migration 027 removed locations; it adds the per-day indexes instead, so these are only made on
-- a database that still has locations.

-- Registration and visit edits already give each visit its own number under the queue lock; this
-- makes the database refuse a duplicate too. "12a" and "12A" count as the same number. If the data
-- already has duplicates, the rule is left out (the server logs a warning) rather than failing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'visits' AND column_name = 'location_id') THEN
    RETURN;
  END IF;
  CREATE INDEX IF NOT EXISTS visits_location_date_idx ON visits (location_id, visit_date);
  CREATE INDEX IF NOT EXISTS patients_location_idx ON patients (location_id);
  IF NOT EXISTS (
    SELECT 1 FROM visits GROUP BY location_id, visit_date, UPPER(queue_no) HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS visits_queue_no_key ON visits (location_id, visit_date, UPPER(queue_no));
  END IF;
END $$;
