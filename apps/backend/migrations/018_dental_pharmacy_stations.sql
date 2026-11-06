-- Migration: Dental and Pharmacy stations.
-- Clinic order is now Triage, Consultation, Physiotherapy, Dental, Partner NGO (seva), Pharmacy.
-- Physiotherapy is chosen by the doctor at Consultation and Pharmacy is added when the doctor
-- prescribes; existing routes are left as they are. Dental notes are one record per visit, like the
-- other station forms. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/018_dental_pharmacy_stations.sql

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
        CHECK (station IN ('triage', 'consultation', 'physiotherapy', 'dental', 'seva', 'pharmacy'));

CREATE TABLE IF NOT EXISTS dental (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    notes TEXT NOT NULL DEFAULT '',            -- what the dental students did
    referral_needed BOOLEAN NOT NULL DEFAULT FALSE,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);
