-- Migration: retire the shared "user" sign-in. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/022_retire_shared_user_account.sql
--
-- Clinics now sign in with the admin account or a screening-day account (users.screening_date
-- set, created on the Accounts page). The fixed "user" / "user" account is disabled, not deleted,
-- so the records it entered still show who entered them. A screening-day account that happens to
-- be called "user" is left alone.
UPDATE users
SET is_active = FALSE, last_updated_at = NOW()
WHERE LOWER(username) = 'user' AND screening_date IS NULL AND is_active;
