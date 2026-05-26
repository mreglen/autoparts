-- Возвраты ЮKassa при ошибке оформления заказа после оплаты

ALTER TABLE yookassa_payments ADD COLUMN IF NOT EXISTS refund_id VARCHAR(64);
ALTER TABLE yookassa_payments ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32);

CREATE INDEX IF NOT EXISTS ix_yookassa_payments_refund_id ON yookassa_payments (refund_id);
