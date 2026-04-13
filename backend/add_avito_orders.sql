-- Migration script for Avito orders integration
-- Run this script to add Avito order statuses and update orders table

-- Create avito_order_statuses table
CREATE TABLE IF NOT EXISTS avito_order_statuses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- Insert Avito order statuses
INSERT INTO avito_order_statuses (code, name, description) VALUES
('on_confirmation', 'Ожидает подтверждения', 'Заказ ожидает подтверждения продавцом'),
('ready_to_ship', 'Ждет отправки', 'Заказ подтвержден и ждет отправки'),
('in_transit', 'В пути', 'Заказ передан в доставку'),
('canceled', 'Отменен', 'Заказ отменен'),
('delivered', 'Доставлен', 'Заказ доставлен покупателю'),
('on_return', 'На возврате', 'Заказ на возврате'),
('in_dispute', 'Открыт спор', 'По заказу открыт спор'),
('closed', 'Закрыт', 'Заказ закрыт')
ON CONFLICT (code) DO NOTHING;

-- Add new columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'garage';

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS avito_order_id BIGINT;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS avito_status_code VARCHAR(50);

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS avito_data JSON;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_avito_order_id ON orders(avito_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_avito_status_code ON orders(avito_status_code);

-- Add comment
COMMENT ON COLUMN orders.source IS 'Источник заказа: garage (Свой Гараж) или avito (Авито)';
COMMENT ON COLUMN orders.avito_order_id IS 'ID заказа в системе Авито';
COMMENT ON COLUMN orders.avito_status_code IS 'Код статуса из Авито API';
COMMENT ON COLUMN orders.avito_data IS 'Дополнительные данные заказа из Авито API в формате JSON';
