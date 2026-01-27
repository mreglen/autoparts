-- Manual SQL script to drop temporary address storage tables
-- Run these commands in your PostgreSQL client (pgAdmin, DBeaver, etc.)

-- Connect to your database first:
-- Host: localhost
-- Database: autoparts
-- Username: postgres
-- Password: root

-- 1. Drop the main table with all dependencies
DROP TABLE IF EXISTS pending_product_storage_cells CASCADE;

-- 2. Drop the sequence if it exists
DROP SEQUENCE IF EXISTS pending_product_storage_cells_id_seq CASCADE;

-- 3. Verify the table was dropped
SELECT tablename 
FROM pg_tables 
WHERE tablename = 'pending_product_storage_cells';

-- 4. Optional: Check for any remaining references
SELECT *
FROM information_schema.tables 
WHERE table_name LIKE '%pending%storage%';

-- If the SELECT query returns no rows, the table has been successfully dropped.