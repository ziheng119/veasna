-- Demo clinic data for local/LAN testing.
-- Safe to re-run: existing locations, patients, visits, and stock rows are skipped.
-- Prerequisite: at least one user exists (run `npm run setup` first).

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users) THEN
        RAISE EXCEPTION 'No users found. Run npm run setup first to create the admin user.';
    END IF;
END $$;

-- Locations (names expected by locations tests)
INSERT INTO locations (name, is_active)
VALUES
    ('Poipet', TRUE),
    ('Mongkol Borey', TRUE),
    ('Sisophon', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Patients
INSERT INTO patients (
    location_id, english_name, khmer_name, date_of_birth, sex,
    address, phone_number, last_updated_by
)
SELECT loc.id, seed.english_name, seed.khmer_name, seed.date_of_birth::date, seed.sex::sex_type,
       seed.address, seed.phone_number, (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM (
    VALUES
        ('Poipet',         'Sophea Chan',   'សុភា ចាន់',   '1985-03-14', 'F', 'Thma Koul, Poipet',        '+85510100001'),
        ('Poipet',         'Vuthy Sorn',    'វុទ្ធី សូន',   '1979-08-22', 'M', 'Kbal Spean, Poipet',       '+85510100002'),
        ('Poipet',         'Sareth Kim',    'សារ៉េត គីម',  '1992-12-05', 'M', 'O''Russey, Poipet',        '+85510100003'),
        ('Poipet',         'Chenda Prak',   'ចិន្តា ប្រាក់', '2018-06-20', 'F', 'Boeung Tumpun, Poipet',    '+85510100004'),
        ('Poipet',         'Rithy Keo',     'រីទី កែវ',    '1968-11-02', 'M', 'Phsar Kandal, Poipet',     '+85510100005'),
        ('Mongkol Borey',  'Dara Long',     'ដារ៉ា លង',    '1990-01-11', 'M', 'Kouk Ballang, Mongkol Borey', '+85510100006'),
        ('Mongkol Borey',  'Sreyneang Im',  'ស្រីណាង អ៊ីម', '1988-06-09', 'F', 'Prey Chhor, Mongkol Borey',  '+85510100007'),
        ('Sisophon',       'Piseth Mean',   'ពីសេធ មៀន',  '1995-05-17', 'M', 'Svay Dangkum, Sisophon',   '+85510100008'),
        ('Sisophon',       'Sokunthea Ty',  'សុខន្ធា ទី',  '1982-10-03', 'F', 'Phsar Ler, Sisophon',      '+85510100009')
) AS seed(location_name, english_name, khmer_name, date_of_birth, sex, address, phone_number)
JOIN locations loc ON loc.name = seed.location_name
WHERE NOT EXISTS (
    SELECT 1 FROM patients p WHERE p.phone_number = seed.phone_number
);

-- Today's visits (appear in the queue)
INSERT INTO visits (patient_id, location_id, queue_no, visit_date, last_updated_by)
SELECT p.id, p.location_id, seed.queue_no, CURRENT_DATE,
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM (
    VALUES
        ('+85510100001', '1'),
        ('+85510100002', '2'),
        ('+85510100003', '3'),
        ('+85510100004', '4'),
        ('+85510100006', '1'),
        ('+85510100007', '2'),
        ('+85510100008', '1')
) AS seed(phone_number, queue_no)
JOIN patients p ON p.phone_number = seed.phone_number
WHERE NOT EXISTS (
    SELECT 1 FROM visits v
    WHERE v.patient_id = p.id AND v.visit_date = CURRENT_DATE
);

-- Prior visit for a returning patient (patient list, not today's queue)
INSERT INTO visits (patient_id, location_id, queue_no, visit_date, last_updated_by)
SELECT p.id, p.location_id, '12', CURRENT_DATE - 14,
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM patients p
WHERE p.phone_number = '+85510100005'
  AND NOT EXISTS (
      SELECT 1 FROM visits v
      WHERE v.patient_id = p.id AND v.visit_date = CURRENT_DATE - 14
  );

-- Registration vitals + HEF for today's visits
INSERT INTO vitals (
    visit_id, height, weight, bmi, below_3rd_percentile,
    bp_systolic, bp_diastolic, temperature, notes, last_updated_by
)
SELECT v.id, seed.height, seed.weight, seed.bmi, seed.below_3rd,
       seed.sys, seed.dia, seed.temp, seed.notes,
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM (
    VALUES
        ('+85510100001', 158, 54, 21.6, FALSE, 118, 74, 36.7, 'Routine screening'),
        ('+85510100002', 170, 72, 24.9, FALSE, 138, 88, 36.8, 'Elevated BP at registration'),
        ('+85510100003', 165, 61, 22.4, FALSE, 120, 78, 36.6, ''),
        ('+85510100004', 108, 14, 12.0, TRUE,  96,  60, 37.4, 'Child underweight — flag for consult'),
        ('+85510100006', 172, 68, 23.0, FALSE, 122, 80, 36.5, ''),
        ('+85510100007', 156, 58, 23.8, FALSE, 110, 70, 36.9, 'HEF card holder'),
        ('+85510100008', 168, 64, 22.7, FALSE, 118, 76, 36.6, '')
) AS seed(phone_number, height, weight, bmi, below_3rd, sys, dia, temp, notes)
JOIN patients p ON p.phone_number = seed.phone_number
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM vitals vt WHERE vt.visit_id = v.id);

INSERT INTO hef (visit_id, know_of_hef, has_hef, notes, last_updated_by)
SELECT v.id, seed.know_of_hef, seed.has_hef, seed.notes,
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM (
    VALUES
        ('+85510100001', TRUE,  FALSE, 'Aware but not enrolled'),
        ('+85510100002', FALSE, FALSE, ''),
        ('+85510100003', TRUE,  TRUE,  'Valid HEF card'),
        ('+85510100004', TRUE,  TRUE,  'Child covered under family HEF'),
        ('+85510100006', FALSE, FALSE, ''),
        ('+85510100007', TRUE,  TRUE,  'Has valid HEF card'),
        ('+85510100008', TRUE,  FALSE, '')
) AS seed(phone_number, know_of_hef, has_hef, notes)
JOIN patients p ON p.phone_number = seed.phone_number
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM hef h WHERE h.visit_id = v.id);

-- Triage: visual acuity + presenting complaint + history
INSERT INTO visual_acuity (
    visit_id, left_with_pinhole, left_without_pinhole,
    right_with_pinhole, right_without_pinhole, notes, last_updated_by
)
SELECT v.id, 6, 12, 6, 9, 'Reduced acuity left eye without pinhole',
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM patients p
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE p.phone_number = '+85510100001'
  AND NOT EXISTS (SELECT 1 FROM visual_acuity va WHERE va.visit_id = v.id);

INSERT INTO presenting_complaint (
    visit_id, history, red_flags, systems_review, drug_allergies, last_updated_by
)
SELECT v.id,
       'Blurred vision for 2 weeks, worse in the left eye.',
       'No sudden vision loss, no trauma.',
       'No fever, no headache.',
       'None known',
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM patients p
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE p.phone_number = '+85510100001'
  AND NOT EXISTS (SELECT 1 FROM presenting_complaint pc WHERE pc.visit_id = v.id);

INSERT INTO history (
    visit_id, past, drug_and_treatment, family, social, systems_review, last_updated_by
)
SELECT v.id,
       'Hypertension diagnosed 2022.',
       'Amlodipine 5mg daily.',
       'Mother has diabetes.',
       'Farmer, smokes occasionally.',
       'Otherwise well.',
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM patients p
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE p.phone_number = '+85510100001'
  AND NOT EXISTS (SELECT 1 FROM history h WHERE h.visit_id = v.id);

-- SEVA follow-up for the same patient
INSERT INTO seva (
    visit_id, left_with_pinhole_new, left_without_pinhole_new,
    right_with_pinhole_new, right_without_pinhole_new,
    diagnosis, date_of_referral, notes, last_updated_by
)
SELECT v.id, 6, 9, 6, 6, 'Refractive error — left eye', CURRENT_DATE,
       'Advised spectacle referral.',
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM patients p
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE p.phone_number = '+85510100001'
  AND NOT EXISTS (SELECT 1 FROM seva s WHERE s.visit_id = v.id);

-- Physiotherapy + pain points
INSERT INTO physiotherapy (visit_id, notes, last_updated_by)
SELECT v.id, 'Lower back pain after lifting. Given stretching advice.',
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM patients p
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE p.phone_number = '+85510100002'
  AND NOT EXISTS (SELECT 1 FROM physiotherapy pt WHERE pt.visit_id = v.id);

INSERT INTO painpoints (physiotherapy_id, x_coord, y_coord, last_updated_by)
SELECT pt.id, seed.x_coord, seed.y_coord,
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM (
    VALUES (48.0::real, 62.0::real), (52.0::real, 64.0::real)
) AS seed(x_coord, y_coord)
JOIN patients p ON p.phone_number = '+85510100002'
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
JOIN physiotherapy pt ON pt.visit_id = v.id
WHERE NOT EXISTS (
    SELECT 1 FROM painpoints pp
    WHERE pp.physiotherapy_id = pt.id
      AND pp.x_coord = seed.x_coord
      AND pp.y_coord = seed.y_coord
);

-- Consult + referral
INSERT INTO consultation (visit_id, notes, prescription, require_referral, last_updated_by)
SELECT v.id,
       'Suspected gastritis. Trial of omeprazole. Refer if no improvement.',
       'Omeprazole 20mg once daily x 14 days',
       TRUE,
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM patients p
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE p.phone_number = '+85510100003'
  AND NOT EXISTS (SELECT 1 FROM consultation c WHERE c.visit_id = v.id);

INSERT INTO referral (
    visit_id, referral_date, referral_type, illness, duration, reason, last_updated_by
)
SELECT v.id, CURRENT_DATE, 'Hospital', 'Gastritis', '3 weeks',
       'Persistent epigastric pain; needs further investigation.',
       (SELECT id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1)
FROM patients p
JOIN visits v ON v.patient_id = p.id AND v.visit_date = CURRENT_DATE
WHERE p.phone_number = '+85510100003'
  AND NOT EXISTS (SELECT 1 FROM referral r WHERE r.visit_id = v.id);

-- Pharmacy stock (mix of healthy / low / out of stock)
DO $$
DECLARE
    updater_id int;
    has_stock_count boolean;
BEGIN
    SELECT id INTO updater_id FROM users WHERE is_active IS TRUE ORDER BY id LIMIT 1;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pharmacy' AND column_name = 'stock_count'
    ) INTO has_stock_count;

    CREATE TEMP TABLE seed_pharmacy (
        location_name text,
        drug_name text,
        stock_count int
    ) ON COMMIT DROP;

    INSERT INTO seed_pharmacy (location_name, drug_name, stock_count) VALUES
        ('Poipet', 'Paracetamol 500mg', 120),
        ('Poipet', 'Amoxicillin 250mg', 45),
        ('Poipet', 'Ibuprofen 400mg', 15),
        ('Poipet', 'Oral Rehydration Salts', 80),
        ('Poipet', 'Albendazole 400mg', 25),
        ('Poipet', 'Metronidazole 250mg', 8),
        ('Poipet', 'Zinc sulfate 20mg', 60),
        ('Poipet', 'Vitamin A 200,000 IU', 0),
        ('Poipet', 'Cetirizine 10mg', 40),
        ('Mongkol Borey', 'Paracetamol 500mg', 90),
        ('Mongkol Borey', 'Amoxicillin 250mg', 12),
        ('Mongkol Borey', 'Ibuprofen 400mg', 30),
        ('Mongkol Borey', 'Oral Rehydration Salts', 18),
        ('Mongkol Borey', 'Vitamin A 200,000 IU', 0),
        ('Sisophon', 'Paracetamol 500mg', 70),
        ('Sisophon', 'Amoxicillin 250mg', 22),
        ('Sisophon', 'Albendazole 400mg', 5),
        ('Sisophon', 'Oral Rehydration Salts', 40);

    IF has_stock_count THEN
        INSERT INTO pharmacy (location_id, drug_name, stock_count, last_updated_by)
        SELECT loc.id, seed.drug_name, seed.stock_count, updater_id
        FROM seed_pharmacy seed
        JOIN locations loc ON loc.name = seed.location_name
        ON CONFLICT (location_id, drug_name) DO NOTHING;
    ELSE
        INSERT INTO pharmacy (location_id, drug_name, stock_level, last_updated_by)
        SELECT loc.id,
               seed.drug_name,
               CASE
                   WHEN seed.stock_count = 0 THEN 'no stock'
                   WHEN seed.stock_count <= 20 THEN 'low'
                   WHEN seed.stock_count <= 50 THEN 'medium'
                   ELSE 'high'
               END,
               updater_id
        FROM seed_pharmacy seed
        JOIN locations loc ON loc.name = seed.location_name
        ON CONFLICT (location_id, drug_name) DO NOTHING;
    END IF;
END $$;

COMMIT;
