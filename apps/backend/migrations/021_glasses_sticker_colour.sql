-- Migration: "with glasses" eye readings and the registration sticker colour. Idempotent.
-- Run: psql -U <user> -d <database> -f migrations/021_glasses_sticker_colour.sql
--
-- Visual acuity with the patient's own glasses on, taken after the readings without and with a
-- pinhole. Optional: NULL when the patient has no glasses or it was not taken.
ALTER TABLE visual_acuity ADD COLUMN IF NOT EXISTS left_with_glasses VARCHAR(15);
ALTER TABLE visual_acuity ADD COLUMN IF NOT EXISTS right_with_glasses VARCHAR(15);
ALTER TABLE seva ADD COLUMN IF NOT EXISTS left_with_glasses_new VARCHAR(15);
ALTER TABLE seva ADD COLUMN IF NOT EXISTS right_with_glasses_new VARCHAR(15);

-- Colour of the sticker given at registration, as an id from the sticker_colours list on the
-- Station data page (e.g. 'light_blue'). Per visit: a returning patient gets a new sticker.
-- NULL when no sticker was given.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS sticker_colour VARCHAR(40);
