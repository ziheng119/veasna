-- Migration: Per-station queues. Each visit lists the stations it is indicated for and moves
-- through them in order; the first station not yet completed is the queue the patient is in.
-- Idempotent. Visits still in the queue without stations are routed through every station.
-- Run: psql -U <user> -d <database> -f migrations/004_visit_stations.sql

CREATE TABLE IF NOT EXISTS visit_stations (
    id SERIAL PRIMARY KEY,
    visit_id INT NOT NULL REFERENCES visits(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    station VARCHAR(30) NOT NULL
        CHECK (station IN ('triage', 'seva', 'physiotherapy', 'consultation')),
    position INT NOT NULL,                 -- order of the station within the visit
    entered_at TIMESTAMP NULL,             -- when the patient joined this station's queue
    completed_at TIMESTAMP NULL,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (visit_id, station)
);

CREATE INDEX IF NOT EXISTS visit_stations_pending_idx
    ON visit_stations (visit_id, position) WHERE completed_at IS NULL;

INSERT INTO visit_stations (visit_id, station, position, entered_at, last_updated_by)
SELECT v.id, s.station, s.position,
       CASE WHEN s.position = 1 THEN v.created_at END,
       v.last_updated_by
FROM visits v
CROSS JOIN (VALUES ('triage', 1), ('seva', 2), ('physiotherapy', 3), ('consultation', 4)) AS s(station, position)
WHERE v.completed_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM visit_stations vs WHERE vs.visit_id = v.id);
