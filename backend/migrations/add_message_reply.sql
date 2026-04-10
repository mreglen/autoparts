-- =====================================================
-- Migration: Add Message Reply Feature
-- Purpose: Allow users to reply to specific messages
-- =====================================================

-- Add reply_to_id column to messages table
ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id);

-- Create index for faster lookups
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);

-- Verification
SELECT COUNT(*) FROM messages WHERE reply_to_id IS NOT NULL; -- Should return 0 initially
