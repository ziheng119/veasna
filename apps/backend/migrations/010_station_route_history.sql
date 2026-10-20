-- Audit route edits before reopening completed stations or removing pending ones.
CREATE TABLE IF NOT EXISTS visit_station_route_history (
    id SERIAL PRIMARY KEY,
    visit_id INT NOT NULL REFERENCES visits(id) ON DELETE CASCADE ON UPDATE CASCADE,
    previous_stations JSONB NOT NULL,
    requested_stations JSONB NOT NULL,
    last_updated_by INT NOT NULL REFERENCES users(id) ON UPDATE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS visit_station_route_history_visit_idx
    ON visit_station_route_history (visit_id, created_at);
