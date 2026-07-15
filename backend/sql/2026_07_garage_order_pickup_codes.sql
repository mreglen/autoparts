-- Pickup verification columns for marketplace garage orders.
-- Dev: also applied by ensure_garage_order_pickup_columns() on startup.

ALTER TABLE garage_used_orders ADD COLUMN IF NOT EXISTS pickup_code_hash VARCHAR(64);
ALTER TABLE garage_used_orders ADD COLUMN IF NOT EXISTS pickup_code_cipher TEXT;
ALTER TABLE garage_used_orders ADD COLUMN IF NOT EXISTS pickup_code_created_at TIMESTAMPTZ;
ALTER TABLE garage_used_orders ADD COLUMN IF NOT EXISTS pickup_code_expires_at TIMESTAMPTZ;
ALTER TABLE garage_used_orders ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMPTZ;
ALTER TABLE garage_used_orders ADD COLUMN IF NOT EXISTS pickup_verify_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE garage_new_orders ADD COLUMN IF NOT EXISTS pickup_code_hash VARCHAR(64);
ALTER TABLE garage_new_orders ADD COLUMN IF NOT EXISTS pickup_code_cipher TEXT;
ALTER TABLE garage_new_orders ADD COLUMN IF NOT EXISTS pickup_code_created_at TIMESTAMPTZ;
ALTER TABLE garage_new_orders ADD COLUMN IF NOT EXISTS pickup_code_expires_at TIMESTAMPTZ;
ALTER TABLE garage_new_orders ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMPTZ;
ALTER TABLE garage_new_orders ADD COLUMN IF NOT EXISTS pickup_verify_attempts INTEGER NOT NULL DEFAULT 0;
