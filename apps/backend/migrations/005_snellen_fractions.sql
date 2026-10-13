-- Store visual acuity as Snellen fractions ("6/6", "6/9") instead of bare numbers.
-- Existing numeric values were the denominator of a 6-metre test, so 9 becomes "6/9".
DO $$
DECLARE
    target RECORD;
BEGIN
    FOR target IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        WHERE c.table_schema = current_schema()
          AND c.data_type = 'numeric'
          AND (
              (c.table_name = 'visual_acuity' AND c.column_name IN (
                  'left_with_pinhole', 'left_without_pinhole',
                  'right_with_pinhole', 'right_without_pinhole'))
              OR (c.table_name = 'seva' AND c.column_name IN (
                  'left_with_pinhole_new', 'left_without_pinhole_new',
                  'right_with_pinhole_new', 'right_without_pinhole_new'))
          )
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE VARCHAR(15) USING ''6/'' || trim_scale(%I)::text',
            target.table_name, target.column_name, target.column_name
        );
    END LOOP;
END $$;
