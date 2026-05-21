-- Warehouse fulfillment tracking for closed Avito orders (stage 4).
-- Run manually on PostgreSQL if schema_patches are not used at startup.

ALTER TABLE avito_orders_cache
    ADD COLUMN IF NOT EXISTS stock_fulfillment_status VARCHAR(20);

ALTER TABLE avito_orders_cache
    ADD COLUMN IF NOT EXISTS last_skip_reasons JSONB;

ALTER TABLE avito_orders_cache
    ADD COLUMN IF NOT EXISTS last_fulfillment_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_avito_orders_cache_stock_fulfillment_status
    ON avito_orders_cache (stock_fulfillment_status);
