-- Add videos column to rejected_products (JSON string of video URLs, mirrors photos)
-- Run on production if GET /api/moderation/products/rejected/my fails with:
--   column rejected_products.videos does not exist

ALTER TABLE rejected_products
ADD COLUMN IF NOT EXISTS videos TEXT NULL;
