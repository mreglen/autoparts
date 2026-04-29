-- Миграция: Добавление полей sale_channel и avito_order_id в таблицу stock_out
-- Дата: 2026-04-29
-- Описание: Для отслеживания канала продажи и связи с заказами Авито

ALTER TABLE stock_out 
ADD COLUMN IF NOT EXISTS sale_channel VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS avito_order_id VARCHAR(64) NULL;

-- Добавляем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_stock_out_sale_channel ON stock_out(sale_channel);
CREATE INDEX IF NOT EXISTS idx_stock_out_avito_order_id ON stock_out(avito_order_id);

COMMENT ON COLUMN stock_out.sale_channel IS 'Канал продажи: avito, drom, warehouse, etc.';
COMMENT ON COLUMN stock_out.avito_order_id IS 'ID заказа Авито для связи с заказами';
