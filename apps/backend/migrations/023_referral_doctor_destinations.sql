-- Migration: doctor named on referral letters, and the new referral destinations. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/023_referral_doctor_destinations.sql
--
-- referral.doctor_name: the doctor chosen in the referral pop-up ("Doctor's name", from the
-- referral_doctors list on the Station data page). It is printed under the signature. Saved as the
-- name itself, so a later change to the list never changes an earlier letter. NULL when no doctor
-- was chosen (older referrals); their letters leave the name blank for writing by hand.
ALTER TABLE referral ADD COLUMN IF NOT EXISTS doctor_name TEXT NULL;

-- One-off data changes that must not run again after an admin edits the result.
CREATE TABLE IF NOT EXISTS applied_data_changes (
    name VARCHAR(80) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Referral destinations are now only the places patients are sent outside the screening on
-- referral days: Preah Ang Duong Hospital, Samdech Ov Referral Hospital and Optician (the built-in
-- list in shared/formOptions.json). Physiotherapy is referred within the screening (Consult page);
-- Dental and the partner NGO are indicated at Triage; Bong Bondol is no longer used. A saved list
-- is removed once, so the new built-in list is used; edits made afterwards on the Station data
-- page are kept. Saved referrals keep the destinations they were saved with.
WITH first_run AS (
    INSERT INTO applied_data_changes (name) VALUES ('023_referral_destinations')
    ON CONFLICT (name) DO NOTHING
    RETURNING name
)
DELETE FROM form_options
WHERE list_key = 'referral_destinations' AND EXISTS (SELECT 1 FROM first_run);
