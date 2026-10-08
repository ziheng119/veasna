-- Migration: Add a role to users so admin-only routes can be enforced
-- Idempotent. Existing users become 'user'; run `npm run seed:admin` to promote ADMIN_USERNAME.
-- Run: psql -U <user> -d <database> -f migrations/003_users_role.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
