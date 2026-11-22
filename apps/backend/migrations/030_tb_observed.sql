-- Migration: TB red flags noted below the threshold. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/030_tb_observed.sql
--
-- A visit registered with fewer than TB_MIN_RED_FLAGS red flags keeps them on its tb_screening row
-- with status 'observed': a record of the symptoms, not a flag. The patient is not shown in red and
-- their stations can still be changed. Flagging at Triage turns the row into 'suspected'.
ALTER TABLE tb_screening DROP CONSTRAINT IF EXISTS tb_screening_status_check;
ALTER TABLE tb_screening ADD CONSTRAINT tb_screening_status_check
    CHECK (status IN ('suspected', 'cleared', 'tb_likely', 'observed'));
