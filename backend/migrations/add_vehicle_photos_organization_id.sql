-- Если таблица vehicle_photos создана без organization_id (ошибка INSERT).
-- Выполнить в PostgreSQL один раз.

ALTER TABLE vehicle_photos
  ADD COLUMN IF NOT EXISTS organization_id VARCHAR(10) REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS ix_vehicle_photos_organization_id ON vehicle_photos (organization_id);
