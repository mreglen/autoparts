-- PostgreSQL: garage_new_orders.user_id + cleanup seller label
-- Run once on production/dev. For SQLite dev, rely on ensure_garage_new_order_user_id_column() in schema_patches.

ALTER TABLE garage_new_orders
  ADD COLUMN IF NOT EXISTS user_id INTEGER NULL REFERENCES users(id);

CREATE INDEX IF NOT EXISTS ix_garage_new_orders_user_id
  ON garage_new_orders (user_id);

UPDATE garage_new_orders
SET seller = NULL
WHERE seller = 'Rossko';

-- Optional backfill user_id from buyer email (PostgreSQL)
UPDATE garage_new_orders o
SET user_id = u.id
FROM users u
WHERE o.user_id IS NULL
  AND o.buyer_email IS NOT NULL
  AND o.buyer_email <> ''
  AND u.email = o.buyer_email;
