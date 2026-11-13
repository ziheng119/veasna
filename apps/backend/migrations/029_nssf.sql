-- Migration: NSSF questions at registration. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/029_nssf.sql
--
-- Asked beside the HEF questions, so kept on the visit's hef row:
--   has_nssf       Does the patient have NSSF (the National Social Security Fund)?
--   uses_hef_nssf  Does the patient use HEF or NSSF? (hef.notes says why or why not.)
-- NULL means not asked: visits registered before this, or by an older app.
ALTER TABLE hef ADD COLUMN IF NOT EXISTS has_nssf BOOLEAN;
ALTER TABLE hef ADD COLUMN IF NOT EXISTS uses_hef_nssf BOOLEAN;
