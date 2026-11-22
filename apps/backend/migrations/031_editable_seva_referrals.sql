-- Migration: Partner NGO referral types become an editable list. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/031_editable_seva_referrals.sql
--
-- seva.referral held one of two fixed ids. The choices now live in form_options
-- (list "seva_referrals", edited on the Station data page), so the fixed check is dropped and the
-- column fits any list id (up to 40 characters). Saved records keep the id they were saved with.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'seva' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%referral%'
  LOOP
    EXECUTE format('ALTER TABLE seva DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE seva ALTER COLUMN referral TYPE VARCHAR(40);
