-- ============================================
-- Critical Fix: chat_media.is_processing NULL values
-- ============================================
-- This fixes the Pydantic validation error:
-- "is_processing - Input should be a valid boolean"
-- 
-- Run this if you're getting 500 errors when loading chat messages
-- ============================================

-- Fix existing NULL values
UPDATE chat_media
SET is_processing = FALSE
WHERE is_processing IS NULL;

-- Set default value to prevent future NULL values
ALTER TABLE chat_media
ALTER COLUMN is_processing SET DEFAULT FALSE;

-- Verify fix
SELECT id, media_type, is_processing, original_filename
FROM chat_media
WHERE is_processing IS NULL;

-- Should return 0 rows
