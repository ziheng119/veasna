-- Null preserves the distinction between historical unlabelled notes and reviewed negatives.
ALTER TABLE consultation ADD COLUMN IF NOT EXISTS condition_categories TEXT[];
