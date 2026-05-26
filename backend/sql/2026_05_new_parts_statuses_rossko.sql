-- Миграция/нормализация статусов новых запчастей (для покупателя)
-- Статусы Rossko НЕ синхронизируются в status_code — их меняют только вручную в /sales/orders.
-- Цель: привести garage_new_orders.status_code и garage_new_order_items.status_code
-- к 5 локальным стадиям UI:
-- 1) new_waiting_confirmation  — Ждёт подтверждения
-- 2) new_assembling            — Комплектуется
-- 3) new_shipped               — Отгружено
-- 4) new_awaiting_arrival     — Ожидает поступления
-- 5) new_received              — Получен

-- 1) Перенос legacy-кодов в новые (best-effort; дальнейшее уточнение сделает Rossko при синке в GET /sales/new-parts-orders)
UPDATE garage_new_orders
SET status_code = CASE status_code
  WHEN 'pending'   THEN 'new_waiting_confirmation'
  WHEN 'confirmed' THEN 'new_awaiting_arrival'
  WHEN 'rejected'  THEN 'new_awaiting_arrival'
  WHEN 'assembled' THEN 'new_assembling'
  WHEN 'shipped'   THEN 'new_shipped'
  WHEN 'delivered' THEN 'new_received'
  WHEN 'closed'    THEN 'new_received'
  ELSE status_code
END;

UPDATE garage_new_order_items
SET status_code = CASE status_code
  WHEN 'pending'   THEN 'new_waiting_confirmation'
  WHEN 'confirmed' THEN 'new_awaiting_arrival'
  WHEN 'rejected'  THEN 'new_awaiting_arrival'
  WHEN 'assembled' THEN 'new_assembling'
  WHEN 'shipped'   THEN 'new_shipped'
  WHEN 'delivered' THEN 'new_received'
  WHEN 'closed'    THEN 'new_received'
  ELSE status_code
END;

-- 2) (опционально) Строгие ограничения можно добавить после успешной миграции всех строк.
-- ALTER TABLE garage_new_orders
--   ADD CONSTRAINT ck_garage_new_orders_status_code
--   CHECK (status_code IN (
--     'new_waiting_confirmation',
--     'new_assembling',
--     'new_shipped',
--     'new_awaiting_arrival',
--     'new_received'
--   ));
--
-- ALTER TABLE garage_new_order_items
--   ADD CONSTRAINT ck_garage_new_order_items_status_code
--   CHECK (status_code IN (
--     'new_waiting_confirmation',
--     'new_assembling',
--     'new_shipped',
--     'new_awaiting_arrival',
--     'new_received'
--   ));

