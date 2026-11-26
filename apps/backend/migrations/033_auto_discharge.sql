-- Migration: visits left open at the end of their clinic day are discharged automatically. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/033_auto_discharge.sql
--
-- visits.auto_discharged: TRUE when the host discharged the visit because its day had ended
-- (utils/autoDischarge.js), not a person. completed_at is when that happened; last_updated_by
-- keeps the last person who changed the visit.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS auto_discharged BOOLEAN NOT NULL DEFAULT FALSE;
