-- Migration: "Refer to optician" moves from the doctor's referral to Triage. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/032_refer_optician.sql
--
-- visual_acuity.refer_optician: ticked at Triage (visual acuity) when the patient should see an
-- optician. Listed on the Analytics page.
ALTER TABLE visual_acuity ADD COLUMN IF NOT EXISTS refer_optician BOOLEAN NOT NULL DEFAULT FALSE;

-- Optician is no longer a referral destination on the doctor's referral (the built-in list in
-- shared/formOptions.json no longer has it). Taken off a saved list once; if an admin adds it back
-- on the Station data page afterwards, it stays. Saved referrals keep the destinations they were
-- saved with (Analytics lists them after the current destinations).
CREATE TABLE IF NOT EXISTS applied_data_changes (
    name VARCHAR(80) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);
WITH first_run AS (
    INSERT INTO applied_data_changes (name) VALUES ('032_remove_optician_destination')
    ON CONFLICT (name) DO NOTHING
    RETURNING name
)
UPDATE form_options
SET items = COALESCE((SELECT jsonb_agg(item ORDER BY position)
                      FROM jsonb_array_elements(items) WITH ORDINALITY AS e(item, position)
                      WHERE lower(btrim(item->>'label')) <> 'optician'), '[]'::jsonb),
    last_updated_at = NOW()
WHERE list_key = 'referral_destinations' AND EXISTS (SELECT 1 FROM first_run)
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(items) AS e(item) WHERE lower(btrim(item->>'label')) = 'optician');
-- A list left empty would have no choices; fall back to the built-in list instead.
DELETE FROM form_options WHERE list_key = 'referral_destinations' AND items = '[]'::jsonb;
