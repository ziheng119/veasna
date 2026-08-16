-- Migration: Mark visits as completed so they leave Today's Queue
-- Idempotent. Existing visits remain in-queue (completed_at stays NULL).
-- Run: psql -U <user> -d <database> -f migrations/002_visits_completed.sql

ALTER TABLE visits ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
