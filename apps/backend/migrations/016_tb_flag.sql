-- Migration: TB becomes a flag on the visit instead of a TB Tent station.
-- A flagged visit (tb_screening.status 'suspected' or 'tb_likely') queues at its normal stations
-- and is shown with a red TB marker in every queue, so doctors can attend to it. Any TB Tent stops
-- are taken out of visit routes (an audit copy goes to visit_station_route_history), and open
-- visits that were waiting at the TB Tent move to their next station, or to Consult if the TB
-- Tent was their only stop. Idempotent: once no 'tb' stops remain, nothing changes.
-- Run: psql -U <user> -d <database> -f migrations/016_tb_flag.sql

INSERT INTO visit_station_route_history (visit_id, previous_stations, requested_stations, last_updated_by)
SELECT vs.visit_id,
       jsonb_agg(to_jsonb(vs) ORDER BY vs.position, vs.id),
       COALESCE(jsonb_agg(vs.station ORDER BY vs.position, vs.id)
                FILTER (WHERE vs.station <> 'tb' AND vs.completed_at IS NULL), '[]'::jsonb),
       (array_agg(vs.last_updated_by ORDER BY vs.id))[1]
FROM visit_stations vs
WHERE vs.visit_id IN (SELECT visit_id FROM visit_stations WHERE station = 'tb')
GROUP BY vs.visit_id;

-- Open visits held only at the TB Tent go to Consult so a doctor still sees them.
INSERT INTO visit_stations (visit_id, station, position, last_updated_by)
SELECT t.visit_id, 'consultation', 4, t.last_updated_by
FROM visit_stations t
JOIN visits v ON v.id = t.visit_id AND v.completed_at IS NULL
WHERE t.station = 'tb' AND t.completed_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM visit_stations o
      WHERE o.visit_id = t.visit_id AND o.station <> 'tb' AND o.completed_at IS NULL
  )
ON CONFLICT (visit_id, station) DO UPDATE SET completed_at = NULL, entered_at = NULL;

-- The patient was waiting at the TB Tent: their next stop becomes current now.
UPDATE visit_stations s SET entered_at = NOW(), last_updated_at = NOW()
WHERE s.entered_at IS NULL
  AND s.id IN (
      SELECT DISTINCT ON (o.visit_id) o.id
      FROM visit_stations o
      JOIN visit_stations t ON t.visit_id = o.visit_id AND t.station = 'tb' AND t.completed_at IS NULL
      WHERE o.station <> 'tb' AND o.completed_at IS NULL
      ORDER BY o.visit_id, o.position, o.id
  );

DELETE FROM visit_stations WHERE station = 'tb';

-- The TB Tent is no longer a station.
DO $$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'visit_stations'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%station%'
    LOOP
        EXECUTE format('ALTER TABLE visit_stations DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE visit_stations
    ADD CONSTRAINT visit_stations_station_check
        CHECK (station IN ('triage', 'seva', 'physiotherapy', 'consultation'));
