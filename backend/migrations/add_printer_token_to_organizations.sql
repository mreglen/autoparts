-- Migration script to add printer_token column to organizations table
-- Run this to update your database schema

-- Add printer_token column (remove api_keys if it exists)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS printer_token VARCHAR(64) NULL;

-- If you have the old api_keys JSON column, remove it
-- Uncomment the next line if needed:
-- ALTER TABLE organizations DROP COLUMN IF EXISTS api_keys;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_organizations_printer_token 
ON organizations(printer_token);

-- Comment to verify the change:
-- SELECT id, name, printer_token FROM organizations LIMIT 10;
