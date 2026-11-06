-- Migration: screening-day accounts and editable form options. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/020_day_accounts_form_options.sql
--
-- users.screening_date: set for a screening-day account (e.g. dec13village), shared by every
-- volunteer on that day. It sees only patients queued on that date, plus their earlier visits, and
-- can save only on that date (utils/dayScope.js). NULL for the fixed admin and user accounts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS screening_date DATE NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_updated_by INT NULL REFERENCES users(id) ON UPDATE CASCADE;

-- Choices offered in station forms that an admin can change (utils/formOptions.js). One row per
-- list; a list without a row uses the built-in defaults in shared/formOptions.json.
-- items: [{ "id": "...", "label": "..." }, ...] in display order.
CREATE TABLE IF NOT EXISTS form_options (
    list_key VARCHAR(40) PRIMARY KEY,
    items JSONB NOT NULL,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);
