-- Migration: Make part_type_id required (NOT NULL) in products table
-- Date: 2026-04-12
-- Description: Changes part_type_id from nullable to required field

-- Step 1: Set a default part_type_id for existing products that have NULL
-- Using "Тормозная система" (id=12) as default - you can change this
UPDATE products 
SET part_type_id = 12 
WHERE part_type_id IS NULL;

-- Step 2: Add NOT NULL constraint to part_type_id column
ALTER TABLE products 
ALTER COLUMN part_type_id SET NOT NULL;

-- Step 3: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_part_type_id ON products(part_type_id);

-- Verification query (optional - check that no NULL values remain)
-- SELECT COUNT(*) FROM products WHERE part_type_id IS NULL;
-- Should return 0
