-- Per-user per-printer label print settings

ALTER TABLE printer_permissions
ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE printer_permissions
ADD COLUMN IF NOT EXISTS label_width_mm INTEGER NOT NULL DEFAULT 80;

ALTER TABLE printer_permissions
ADD COLUMN IF NOT EXISTS label_height_mm INTEGER NOT NULL DEFAULT 45;

