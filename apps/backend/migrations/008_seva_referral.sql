-- Seva records whether the patient needs to be referred, and for what.
-- NULL means no referral.
ALTER TABLE seva
    ADD COLUMN IF NOT EXISTS referral VARCHAR(30)
        CHECK (referral IN ('cataract_surgery', 'seva_general'));
