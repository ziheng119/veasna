-- Additive: existing referrals remain unsigned until explicitly signed.
ALTER TABLE referral ADD COLUMN IF NOT EXISTS signature JSONB;
ALTER TABLE referral ADD COLUMN IF NOT EXISTS signer_id INTEGER REFERENCES users(id);
ALTER TABLE referral ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE referral ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
