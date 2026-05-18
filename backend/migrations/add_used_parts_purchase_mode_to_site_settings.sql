ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS used_parts_purchase_mode VARCHAR(20) NOT NULL DEFAULT 'both';
