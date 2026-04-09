-- ============================================
-- Chat System Complete Migration
-- ============================================
-- This migration includes all fixes for the chat system
-- Run this script to set up or fix chat-related database issues
-- ============================================

-- 1. Fix NULL values in chat_media.is_processing
-- Set all NULL values to FALSE to prevent Pydantic validation errors
UPDATE chat_media
SET is_processing = FALSE
WHERE is_processing IS NULL;

-- 2. Ensure is_processing column has a default value
-- This prevents future NULL values
ALTER TABLE chat_media
ALTER COLUMN is_processing SET DEFAULT FALSE;

-- 3. Add indexes for better query performance
-- Index for finding media that needs processing
CREATE INDEX IF NOT EXISTS idx_chat_media_processing 
ON chat_media(is_processing) 
WHERE is_processing = TRUE;

-- Index for querying media by message
CREATE INDEX IF NOT EXISTS idx_chat_media_message_id 
ON chat_media(message_id);

-- Index for querying messages by chat
CREATE INDEX IF NOT EXISTS idx_messages_chat_id 
ON messages(chat_id);

-- Index for read status queries
CREATE INDEX IF NOT EXISTS idx_messages_is_read 
ON messages(is_read, chat_id);

-- 4. Verify the fixes
SELECT 
    'chat_media' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE is_processing = TRUE) as processing,
    COUNT(*) FILTER (WHERE is_processing = FALSE) as completed,
    COUNT(*) FILTER (WHERE is_processing IS NULL) as null_values
FROM chat_media

UNION ALL

SELECT 
    'messages' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE is_read = TRUE) as read_messages,
    COUNT(*) FILTER (WHERE is_read = FALSE) as unread_messages,
    NULL as null_values
FROM messages;

-- 5. Show sample data
SELECT 
    id,
    media_type,
    is_processing,
    original_filename,
    file_size,
    created_at
FROM chat_media
ORDER BY created_at DESC
LIMIT 10;
