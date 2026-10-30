-- Migration: Replace qualitative stock_level with numeric stock_count
-- Idempotent and safe to run at every server start. Stock is reset to 0 only once,
-- while converting a database that still has the old stock_level column; later runs
-- leave counted stock untouched.
-- Run: psql -U <user> -d <database> -f migrations/001_pharmacy_numeric_stock.sql

ALTER TABLE pharmacy ADD COLUMN IF NOT EXISTS stock_count INT NOT NULL DEFAULT 0 CHECK (stock_count >= 0);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'pharmacy'::regclass AND attname = 'stock_level' AND NOT attisdropped
  ) THEN
    UPDATE pharmacy SET stock_count = 0;
    ALTER TABLE pharmacy DROP COLUMN stock_level;
  END IF;
END $$;
