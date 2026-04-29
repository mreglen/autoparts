-- Миграция: Добавление поля closed_processed в таблицу avito_orders_cache
-- Дата: 2026-04-29
-- Описание: Поле для отслеживания обработки закрытых заказов Авито
--           closed_processed = false - заказ со статусом closed еще не обработан
--           closed_processed = true - заказ уже обработан (stock-out создан, количество уменьшено и т.д.)

ALTER TABLE avito_orders_cache 
ADD COLUMN IF NOT EXISTS closed_processed BOOLEAN NOT NULL DEFAULT false;

-- Комментарий к колонке
COMMENT ON COLUMN avito_orders_cache.closed_processed IS 'Флаг обработки закрытого заказа (closed)';
