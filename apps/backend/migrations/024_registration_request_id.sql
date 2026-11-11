-- Migration: registrations that are safe to send again. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/024_registration_request_id.sql
--
-- A device sends a one-off id with each registration and sends the same id again if it never got
-- the answer (e.g. Wi-Fi dropped after the host saved it). The host then returns that registration
-- instead of queuing the patient a second time. NULL for visits registered before this change.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS request_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS visits_request_id_key ON visits (request_id) WHERE request_id IS NOT NULL;
