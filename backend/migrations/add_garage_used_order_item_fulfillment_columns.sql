-- Stage 3: link garage_used_order_items to stock_out after assembled fulfillment.

ALTER TABLE garage_used_order_items
    ADD COLUMN IF NOT EXISTS stock_out_id INTEGER;

ALTER TABLE garage_used_order_items
    ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_garage_used_order_item_stock_out'
    ) THEN
        ALTER TABLE garage_used_order_items
            ADD CONSTRAINT fk_garage_used_order_item_stock_out
            FOREIGN KEY (stock_out_id)
            REFERENCES stock_out(id)
            ON DELETE SET NULL;
    END IF;
END $$;
