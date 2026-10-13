-- Station forms can be saved partially filled: readings and dates not yet taken are stored as NULL.
ALTER TABLE visual_acuity
    ALTER COLUMN left_with_pinhole DROP NOT NULL,
    ALTER COLUMN left_without_pinhole DROP NOT NULL,
    ALTER COLUMN right_with_pinhole DROP NOT NULL,
    ALTER COLUMN right_without_pinhole DROP NOT NULL;

ALTER TABLE seva
    ALTER COLUMN left_with_pinhole_new DROP NOT NULL,
    ALTER COLUMN left_without_pinhole_new DROP NOT NULL,
    ALTER COLUMN right_with_pinhole_new DROP NOT NULL,
    ALTER COLUMN right_without_pinhole_new DROP NOT NULL,
    ALTER COLUMN date_of_referral DROP NOT NULL;

ALTER TABLE referral
    ALTER COLUMN referral_date DROP NOT NULL;
