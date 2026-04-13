-- Migration script to add 'enabled' column to organization_avito_integration table
-- Run this script to add the new column with default value TRUE

ALTER TABLE organization_avito_integration 
ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Update existing records to be enabled by default
UPDATE organization_avito_integration 
SET enabled = TRUE 
WHERE enabled IS NULL;
