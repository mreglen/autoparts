ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS new_parts_markup_percent DOUBLE PRECISION;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS new_parts_markup_manual BOOLEAN NOT NULL DEFAULT FALSE;

-- Initialize org markup from global site settings (non-manual baseline)
UPDATE organizations o
SET new_parts_markup_percent = COALESCE(
    (SELECT s.new_parts_markup_percent FROM site_settings s WHERE s.id = 1 LIMIT 1),
    15.0
)
WHERE o.new_parts_markup_percent IS NULL;
