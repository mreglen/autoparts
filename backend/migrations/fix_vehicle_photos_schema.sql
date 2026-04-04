  -- Исправление схемы vehicle_photos под ORM (photo_path, processing_status, sort_order).
  -- Ошибка: столбец "photo_path" не существует — часто в БД осталось имя photo_url (как у product_photos).

  -- Переименовать photo_url → photo_path
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vehicle_photos' AND column_name = 'photo_url'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vehicle_photos' AND column_name = 'photo_path'
    ) THEN
      ALTER TABLE vehicle_photos RENAME COLUMN photo_url TO photo_path;
    END IF;
  END $$;

  -- Если колонки пути всё ещё нет — добавить с временным default, потом убрать default
  ALTER TABLE vehicle_photos ADD COLUMN IF NOT EXISTS photo_path TEXT NOT NULL DEFAULT '/temp/migration-pending';
  ALTER TABLE vehicle_photos ALTER COLUMN photo_path DROP DEFAULT;

  UPDATE vehicle_photos
  SET photo_path = '/temp/migration-pending'
  WHERE photo_path IS NULL OR TRIM(photo_path) = '';

  ALTER TABLE vehicle_photos ALTER COLUMN photo_path SET NOT NULL;

  ALTER TABLE vehicle_photos ADD COLUMN IF NOT EXISTS organization_id VARCHAR(10) REFERENCES organizations(id);
  CREATE INDEX IF NOT EXISTS ix_vehicle_photos_organization_id ON vehicle_photos (organization_id);

  ALTER TABLE vehicle_photos ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) NOT NULL DEFAULT 'pending';
  ALTER TABLE vehicle_photos ADD COLUMN IF NOT EXISTS sort_order SMALLINT NOT NULL DEFAULT 0;

  CREATE INDEX IF NOT EXISTS ix_vehicle_photos_vehicle_id ON vehicle_photos (vehicle_id);
