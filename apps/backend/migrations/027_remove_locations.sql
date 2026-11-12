-- Migration: one clinic, no locations. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/027_remove_locations.sql
--
-- Screenings no longer choose a location: every device sees the same queue, Patient List and
-- pharmacy. The place a screening-day account is for is part of its username (e.g. dec13village).
-- Take a backup first (npm run backup): which location each patient, visit and drug belonged to is
-- not kept.
--
-- 1. Pharmacy: one stock list. A drug kept at more than one location becomes one row (the oldest)
--    holding the stock of all of them; prescriptions and dispenses point at that row.
-- 2. Families: letters were given per location. A letter used at two locations stays with the
--    first location's family; the others get the first free letter, so families never merge.
-- 3. Queue numbers: one series per day. Past days where two locations both issued a number keep
--    both; the database refuses a repeated number only on the days after them.
DO $$
DECLARE
    family_group RECORD;
    letters TEXT;
    n INT;
    i INT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'pharmacy' AND column_name = 'location_id') THEN
        CREATE TEMP TABLE drug_merge AS
            SELECT id, MIN(id) OVER (PARTITION BY drug_name) AS keep_id FROM pharmacy;
        UPDATE pharmacy p SET stock_count = merged.total, last_updated_at = NOW()
        FROM (
            SELECT m.keep_id, SUM(d.stock_count)::int AS total
            FROM drug_merge m JOIN pharmacy d ON d.id = m.id
            GROUP BY m.keep_id HAVING COUNT(*) > 1
        ) merged
        WHERE p.id = merged.keep_id;
        IF to_regclass('prescriptions') IS NOT NULL THEN
            UPDATE prescriptions x SET drug_id = m.keep_id FROM drug_merge m WHERE x.drug_id = m.id AND m.id <> m.keep_id;
        END IF;
        IF to_regclass('pharmacy_dispenses') IS NOT NULL THEN
            UPDATE pharmacy_dispenses x SET drug_id = m.keep_id FROM drug_merge m WHERE x.drug_id = m.id AND m.id <> m.keep_id;
        END IF;
        DELETE FROM pharmacy p USING drug_merge m WHERE p.id = m.id AND m.id <> m.keep_id;
        DROP TABLE drug_merge;
        -- Also drops UNIQUE (location_id, drug_name).
        ALTER TABLE pharmacy DROP COLUMN location_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'pharmacy'::regclass AND conname = 'pharmacy_drug_name_key') THEN
        ALTER TABLE pharmacy ADD CONSTRAINT pharmacy_drug_name_key UNIQUE (drug_name);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'patients' AND column_name = 'location_id') THEN
        FOR family_group IN
            SELECT DISTINCT p.location_id, p.family FROM patients p
            WHERE p.family IS NOT NULL AND EXISTS (
                SELECT 1 FROM patients o
                WHERE o.family = p.family AND COALESCE(o.location_id, 0) < COALESCE(p.location_id, 0))
            ORDER BY 1, 2
        LOOP
            -- First free letters, counting A, B, ... Z, AA, AB (utils/family.js).
            i := 0;
            LOOP
                letters := '';
                n := i + 1;
                WHILE n > 0 LOOP
                    letters := chr(65 + ((n - 1) % 26)) || letters;
                    n := (n - 1) / 26;
                END LOOP;
                EXIT WHEN NOT EXISTS (SELECT 1 FROM patients WHERE family = letters);
                i := i + 1;
            END LOOP;
            UPDATE patients SET family = letters, last_updated_at = NOW()
            WHERE location_id IS NOT DISTINCT FROM family_group.location_id AND family = family_group.family;
        END LOOP;
        ALTER TABLE patients DROP COLUMN location_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = current_schema() AND table_name = 'visits' AND column_name = 'location_id') THEN
        ALTER TABLE visits DROP COLUMN location_id;
    END IF;
END $$;

DROP TABLE IF EXISTS locations;

-- Replaces the per-location indexes, which went with the columns.
CREATE INDEX IF NOT EXISTS visits_date_idx ON visits (visit_date);
CREATE INDEX IF NOT EXISTS patients_family_idx ON patients (family) WHERE family IS NOT NULL;

-- One queue number per day ("12a" and "12A" are the same number), from the day after the last day
-- that already repeats one.
DO $$
DECLARE
    last_repeat DATE;
BEGIN
    IF to_regclass('visits_day_queue_no_key') IS NULL THEN
        SELECT MAX(visit_date) INTO last_repeat FROM (
            SELECT visit_date FROM visits GROUP BY visit_date, UPPER(queue_no) HAVING COUNT(*) > 1
        ) repeats;
        IF last_repeat IS NULL THEN
            CREATE UNIQUE INDEX visits_day_queue_no_key ON visits (visit_date, UPPER(queue_no));
        ELSE
            EXECUTE format('CREATE UNIQUE INDEX visits_day_queue_no_key ON visits (visit_date, UPPER(queue_no)) WHERE visit_date > %L::date', last_repeat);
        END IF;
    END IF;
END $$;
