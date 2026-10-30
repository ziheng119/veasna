-- Migration: prescriptions linked to pharmacy inventory.
-- A doctor prescribes a drug from the location's pharmacy with a quantity. While the prescription
-- is pending, its quantity is reserved: available = stock_count - pending quantities. Pharmacy
-- staff dispense it (stock_count goes down) or it is cancelled (the reservation is released).
-- Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/017_prescriptions.sql

CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    visit_id INT NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    -- NULL only if the drug was later removed from the pharmacy; drug_name keeps what was prescribed.
    drug_id INT NULL REFERENCES pharmacy(id) ON DELETE SET NULL ON UPDATE CASCADE,
    drug_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    instructions TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'dispensed', 'cancelled')),
    prescribed_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    prescribed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    dispensed_by INT NULL REFERENCES users(id) ON UPDATE CASCADE,
    dispensed_at TIMESTAMP NULL,
    cancelled_by INT NULL REFERENCES users(id) ON UPDATE CASCADE,
    cancelled_at TIMESTAMP NULL,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prescriptions_visit_idx ON prescriptions (visit_id);
-- Reserved stock per drug is the sum of its pending prescriptions.
CREATE INDEX IF NOT EXISTS prescriptions_pending_drug_idx ON prescriptions (drug_id) WHERE status = 'pending';
