-- Migration: what each non-admin account may do. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/028_account_permissions.sql
--
-- users.permissions lists the permissions the admin ticked when making the account (the keys are in
-- utils/permissions.js). The admin account ignores it and may do everything. Existing accounts get
-- the default, which is what they could do before: see everyone queued today and edit the queue.
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT ARRAY['view_today', 'edit_today']::TEXT[];
