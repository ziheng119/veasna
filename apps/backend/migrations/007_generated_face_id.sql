-- Face ID is generated from the patient's details instead of being typed in:
-- first 3 characters of the English name + first 3 of the Khmer name + date of birth (DDMMYYYY),
-- upper-cased with spaces removed. A missing part is left out.
-- It identifies a person for staff but is not guaranteed unique; patients.id remains the key.
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_face_id_key;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'patients' AND column_name = 'face_id'
          AND data_type <> 'character varying'
    ) THEN
        ALTER TABLE patients ALTER COLUMN face_id TYPE VARCHAR(40) USING face_id::text;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION patient_face_id(english_name TEXT, khmer_name TEXT, date_of_birth DATE)
RETURNS TEXT AS $$
    SELECT NULLIF(
        UPPER(
            LEFT(regexp_replace(COALESCE(english_name, ''), '\s', '', 'g'), 3)
            || LEFT(regexp_replace(COALESCE(khmer_name, ''), '\s', '', 'g'), 3)
        ) || COALESCE(TO_CHAR(date_of_birth, 'DDMMYYYY'), ''),
        ''
    );
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_patient_face_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.face_id := patient_face_id(NEW.english_name, NEW.khmer_name, NEW.date_of_birth);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_patient_face_id ON patients;
CREATE TRIGGER trg_set_patient_face_id
BEFORE INSERT OR UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION set_patient_face_id();

-- Regenerate for existing patients (the trigger fills in the value).
UPDATE patients
SET face_id = NULL
WHERE face_id IS DISTINCT FROM patient_face_id(english_name, khmer_name, date_of_birth);
