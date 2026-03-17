-- Migration script to add updated_at column to product_videos table
-- This fixes the "column updated_at does not exist" error

-- Add updated_at column with default value of current timestamp
ALTER TABLE product_videos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add created_at column if it doesn't exist (for consistency)
ALTER TABLE product_videos 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index on updated_at for better query performance
CREATE INDEX IF NOT EXISTS idx_product_videos_updated_at ON product_videos(updated_at);

-- Update existing records to have created_at = now() if they don't have it
UPDATE product_videos SET created_at = NOW() WHERE created_at IS NULL;
UPDATE product_videos SET updated_at = NOW() WHERE updated_at IS NULL;

-- Add comment to document the purpose of these columns
COMMENT ON COLUMN product_videos.updated_at IS 'Timestamp when the video record was last updated';
COMMENT ON COLUMN product_videos.created_at IS 'Timestamp when the video record was created';
