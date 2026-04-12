-- ============================================================================
-- Migration: Add part_type_id to pending_products table
-- ============================================================================
-- Description: Add part_type_id column to support part type selection
--              with custom input (combobox) for pending products
-- ============================================================================

-- Add part_type_id column (nullable initially)
ALTER TABLE pending_products
ADD COLUMN IF NOT EXISTS part_type_id INTEGER REFERENCES part_types(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_pending_products_part_type 
ON pending_products(part_type_id);

-- Comment
COMMENT ON COLUMN pending_products.part_type_id IS 'ID of the part type (required field)';
