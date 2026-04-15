-- Add avito_id column to product_avito_listing_links table
-- This column will store the real Avito item_id (separate from avito_ad_id which stores internal_code)

ALTER TABLE product_avito_listing_links ADD COLUMN IF NOT EXISTS avito_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_product_avito_listing_avito_id ON product_avito_listing_links(avito_id);
