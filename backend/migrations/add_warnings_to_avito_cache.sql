-- Add warnings_json column to organization_avito_autoload_cache table
-- This stores warning messages about XLSX file format issues

ALTER TABLE organization_avito_autoload_cache 
ADD COLUMN IF NOT EXISTS warnings_json TEXT DEFAULT '[]';

-- Add comment to document the column
COMMENT ON COLUMN organization_avito_autoload_cache.warnings_json IS 'JSON array of warning strings about file format or data issues';
