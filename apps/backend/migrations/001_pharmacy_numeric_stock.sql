-- Migration: Replace qualitative stock_level with numeric stock_count
-- Idempotent. Existing stock is reset to 0.
-- Run: psql -U <user> -d <database> -f migrations/001_pharmacy_numeric_stock.sql

ALTER TABLE pharmacy ADD COLUMN IF NOT EXISTS stock_count INT NOT NULL DEFAULT 0 CHECK (stock_count >= 0);
ALTER TABLE pharmacy DROP COLUMN IF EXISTS stock_level;
UPDATE pharmacy SET stock_count = 0;
