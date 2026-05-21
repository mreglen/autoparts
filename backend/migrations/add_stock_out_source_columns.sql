-- Этап 1: единый контур продажи и склада.
-- Добавляет источник stock_out и идемпотентность для Авито/будущего marketplace_used.

ALTER TABLE stock_out
ADD COLUMN IF NOT EXISTS source_kind VARCHAR(32);

ALTER TABLE stock_out
ADD COLUMN IF NOT EXISTS garage_used_order_item_id INTEGER;

UPDATE stock_out
SET source_kind = CASE
    WHEN sale_channel = 'avito' OR avito_order_id IS NOT NULL THEN 'avito'
    WHEN COALESCE(sale_price, 0) > 0 THEN 'warehouse_manual'
    ELSE 'writeoff'
END
WHERE source_kind IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_stock_out_garage_used_order_item'
    ) THEN
        ALTER TABLE stock_out
        ADD CONSTRAINT fk_stock_out_garage_used_order_item
        FOREIGN KEY (garage_used_order_item_id)
        REFERENCES garage_used_order_items(id)
        ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM stock_out
        WHERE source_kind = 'avito' AND avito_order_id IS NOT NULL
        GROUP BY organization_id, avito_order_id, product_id
        HAVING COUNT(*) > 1
        LIMIT 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_out_avito_source_product
        ON stock_out (organization_id, avito_order_id, product_id)
        WHERE source_kind = 'avito' AND avito_order_id IS NOT NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_out_garage_used_order_item
ON stock_out (garage_used_order_item_id)
WHERE garage_used_order_item_id IS NOT NULL;
