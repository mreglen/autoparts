-- SQL script to drop temporary address storage related tables
-- This script removes all database tables related to pending product storage cells

-- Drop the pending_product_storage_cells table
DROP TABLE IF EXISTS pending_product_storage_cells CASCADE;

-- Drop any related sequences (if they exist)
DROP SEQUENCE IF EXISTS pending_product_storage_cells_id_seq CASCADE;

-- Optional: Clean up any orphaned data in related tables
-- This removes any pending_product_storage_cells entries that might have been left behind
DELETE FROM pending_product_storage_cells WHERE pending_product_id NOT IN (SELECT id FROM pending_products);
DELETE FROM pending_product_storage_cells WHERE storage_cell_id NOT IN (SELECT id FROM storage_cells);

-- Optional: Reset auto-increment counters
-- Note: This syntax may vary depending on your database system
-- For PostgreSQL:
SELECT setval('pending_product_storage_cells_id_seq', (SELECT MAX(id) FROM pending_product_storage_cells));

-- For MySQL:
-- ALTER TABLE pending_product_storage_cells AUTO_INCREMENT = 1;

-- Verify that the table has been dropped
-- SELECT tablename FROM pg_tables WHERE tablename = 'pending_product_storage_cells';