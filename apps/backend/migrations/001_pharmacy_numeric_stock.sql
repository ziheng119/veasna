-- Migration: Replace qualitative stock_level with numeric stock_count
-- Run: psql -U <user> -d <database> -f migrations/001_pharmacy_numeric_stock.sql

ALTER TABLE pharmacy ADD COLUMN stock_count INT NOT NULL DEFAULT 0 CHECK (stock_count >= 0);
ALTER TABLE pharmacy DROP COLUMN stock_level;
