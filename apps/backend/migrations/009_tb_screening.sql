-- Migration: TB screening. Patients flagged with TB red flags at registration (or later) are
-- queued at the TB tent first and cannot be seen at any other station until a TB doctor clears them.
-- Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/009_tb_screening.sql

-- Allow the TB tent station in visit routing
DO $$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'visit_stations'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%station%'
    LOOP
        EXECUTE format('ALTER TABLE visit_stations DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE visit_stations
    ADD CONSTRAINT visit_stations_station_check
        CHECK (station IN ('tb', 'triage', 'seva', 'physiotherapy', 'consultation'));

-- One TB screening per visit. status: suspected (waiting for the TB doctor), cleared (no TB,
-- may go to other stations), tb_likely (TB not ruled out; stays isolated until discharged).
CREATE TABLE IF NOT EXISTS tb_screening (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    red_flags TEXT[] NOT NULL DEFAULT '{}',
    flag_notes TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'suspected'
        CHECK (status IN ('suspected', 'cleared', 'tb_likely')),
    doctor_notes TEXT NOT NULL DEFAULT '',
    flagged_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    flagged_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_by INT NULL REFERENCES users(id) ON UPDATE CASCADE,
    reviewed_at TIMESTAMP NULL,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);
