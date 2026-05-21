-- Extend event_log for audit journal (PostgreSQL)
ALTER TABLE event_log ADD COLUMN IF NOT EXISTS organization_id VARCHAR(10);
ALTER TABLE event_log ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE event_log ADD COLUMN IF NOT EXISTS summary VARCHAR(500);
ALTER TABLE event_log ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);
ALTER TABLE event_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE event_log ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE event_log ADD COLUMN IF NOT EXISTS entity_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS ix_event_log_category ON event_log (category);
CREATE INDEX IF NOT EXISTS ix_event_log_organization_id ON event_log (organization_id);
CREATE INDEX IF NOT EXISTS ix_event_log_created_at ON event_log (created_at DESC);
