-- Migration: a record of each walk-in dispense (without a prescription). Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/025_pharmacy_dispenses.sql
--
-- Until now a walk-in dispense only lowered pharmacy.stock_count. Each one is now recorded, with the
-- device's one-off request_id: if the device sends it again (it never got the answer), the host
-- answers without taking the stock a second time. The drug name is kept if the drug is deleted.
CREATE TABLE IF NOT EXISTS pharmacy_dispenses (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(64) UNIQUE,
    drug_id INT REFERENCES pharmacy(id) ON DELETE SET NULL ON UPDATE CASCADE,
    drug_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    dispensed_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    dispensed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
