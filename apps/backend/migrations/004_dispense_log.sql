-- Migration: append-only record of pharmacy stock dispensed.
-- Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/004_dispense_log.sql

CREATE TABLE IF NOT EXISTS dispense_log (
    id SERIAL PRIMARY KEY,
    pharmacy_id INT NOT NULL REFERENCES pharmacy(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    visit_id INT REFERENCES visits(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    dispensed_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    dispensed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dispense_log_pharmacy_idx ON dispense_log (pharmacy_id);
CREATE INDEX IF NOT EXISTS dispense_log_visit_idx ON dispense_log (visit_id);
