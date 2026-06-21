-- =========================================
-- PostgreSQL Setup Script with CASCADE
-- =========================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS referral CASCADE;
DROP TABLE IF EXISTS painpoints CASCADE;
DROP TABLE IF EXISTS consultation CASCADE;
DROP TABLE IF EXISTS physiotherapy CASCADE;
DROP TABLE IF EXISTS seva CASCADE;
DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS presenting_complaint CASCADE;
DROP TABLE IF EXISTS visual_acuity CASCADE;
DROP TABLE IF EXISTS hef CASCADE;
DROP TABLE IF EXISTS vitals CASCADE;
DROP TABLE IF EXISTS visits CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS pharmacy CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Locations
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Patients
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    face_id INT UNIQUE NOT NULL,
    location_id INT REFERENCES locations(id),           -- Will not be deleted, set inactive only
    english_name VARCHAR(255),
    khmer_name VARCHAR(255),
    date_of_birth DATE,
    sex CHAR(1) CHECK (sex IN ('M', 'F')),
    address TEXT,
    phone_number VARCHAR(50),
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,           -- Will not be deleted, set inactive only
    created_at TIMESTAMP DEFAULT NOW()
);

-- Visits
CREATE TABLE visits (
    id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES patients(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    location_id INT REFERENCES locations(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    queue_no VARCHAR(50) NOT NULL,
    visit_date DATE NOT NULL,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Vitals
CREATE TABLE vitals (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    height NUMERIC NOT NULL CHECK (height > 0),
    weight NUMERIC NOT NULL CHECK (weight > 0),
    bmi NUMERIC NOT NULL CHECK (bmi > 0),
    below_3rd_percentile BOOLEAN NOT NULL,
    bp_systolic INT NOT NULL,
    bp_diastolic INT NOT NULL,
    temperature NUMERIC NOT NULL,
    notes TEXT DEFAULT '',
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- HEF
CREATE TABLE hef (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    know_of_hef BOOLEAN NOT NULL,
    has_hef BOOLEAN NOT NULL,
    notes TEXT DEFAULT '',
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Visual Acuity
CREATE TABLE visual_acuity (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    left_with_pinhole NUMERIC NOT NULL,
    left_without_pinhole NUMERIC NOT NULL,
    right_with_pinhole NUMERIC NOT NULL,
    right_without_pinhole NUMERIC NOT NULL,
    notes TEXT DEFAULT '',
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Presenting Complaint
CREATE TABLE presenting_complaint (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    history TEXT NOT NULL,
    red_flags TEXT NOT NULL,
    systems_review TEXT NOT NULL,
    drug_allergies TEXT NOT NULL,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- History
CREATE TABLE history (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    past TEXT NOT NULL,
    drug_and_treatment TEXT NOT NULL,
    family TEXT NOT NULL,
    social TEXT NOT NULL,
    systems_review TEXT NOT NULL,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SEVA
CREATE TABLE seva (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    left_with_pinhole_new NUMERIC NOT NULL,
    left_without_pinhole_new NUMERIC NOT NULL,
    right_with_pinhole_new NUMERIC NOT NULL,
    right_without_pinhole_new NUMERIC NOT NULL,
    diagnosis TEXT NOT NULL,
    date_of_referral DATE NOT NULL,
    notes TEXT DEFAULT '',
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Physiotherapy
CREATE TABLE physiotherapy (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    notes TEXT DEFAULT '',
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Consultation
CREATE TABLE consultation (
    id SERIAL PRIMARY KEY,
    visit_id INT UNIQUE NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    notes TEXT DEFAULT '',
    prescription TEXT NOT NULL,
    require_referral BOOLEAN NOT NULL DEFAULT FALSE,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Painpoints
CREATE TABLE painpoints (
    id SERIAL PRIMARY KEY,
    physiotherapy_id INT NOT NULL REFERENCES physiotherapy(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    x_coord REAL NOT NULL CHECK (x_coord >= 0 AND x_coord <= 100),
    y_coord REAL NOT NULL CHECK (y_coord >= 0 AND y_coord <= 100),
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Referral
CREATE TABLE referral (
    id SERIAL PRIMARY KEY,
    visit_id INT NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    referral_date DATE NOT NULL,
    referral_type TEXT NOT NULL,
    illness VARCHAR(255) NOT NULL,
    duration VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT referral_visit_unique UNIQUE (visit_id) -- ensures one referral per visit
);


-- Pharmacy
CREATE TABLE pharmacy (
    id SERIAL PRIMARY KEY,
    location_id INT NOT NULL REFERENCES locations(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    drug_name VARCHAR(255) NOT NULL,
    stock_level VARCHAR(50) NOT NULL CHECK (stock_level IN ('low', 'medium', 'high', 'no stock')),
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (location_id, drug_name)
);

CREATE OR REPLACE FUNCTION delete_referrals_on_consultation_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM referral WHERE visit_id = OLD.visit_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_delete_referrals
AFTER DELETE ON consultation
FOR EACH ROW
EXECUTE FUNCTION delete_referrals_on_consultation_delete();
