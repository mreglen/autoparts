BEGIN;

-- legacy (old orders)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

DROP TABLE IF EXISTS new_parts_orders CASCADE;
DROP TABLE IF EXISTS used_parts_orders CASCADE;

DROP TABLE IF EXISTS order_item_statuses CASCADE;
DROP TABLE IF EXISTS order_statuses CASCADE;

DROP TABLE IF EXISTS rossko_statuses CASCADE;
DROP TABLE IF EXISTS avito_order_statuses CASCADE;

-- v2 (split orders)
DROP TABLE IF EXISTS used_parts_order_items CASCADE;
DROP TABLE IF EXISTS used_parts_order_statuses CASCADE;

DROP TABLE IF EXISTS new_parts_order_items_v2 CASCADE;
DROP TABLE IF EXISTS new_parts_orders_v2 CASCADE;
DROP TABLE IF EXISTS new_parts_order_statuses CASCADE;

DROP TABLE IF EXISTS avito_orders_v2 CASCADE;

COMMIT;


-- 
BEGIN;

CREATE TABLE IF NOT EXISTS order_statuses (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO order_statuses (code, name) VALUES
  ('on_confirmation', 'Ожидает подтверждения'),
  ('ready_to_ship', 'Ждет отправки'),
  ('in_transit', 'В пути'),
  ('canceled', 'Отмененный заказ'),
  ('delivered', 'Доставлен покупателю'),
  ('on_return', 'На возврате'),
  ('in_dispute', 'По заказу открыт спор'),
  ('closed', 'Заказ закрыт')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

COMMIT;