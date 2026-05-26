-- ЮKassa: сессии checkout и платежи (PostgreSQL)
-- Выполнить вручную при деплое, если schema_patches не сработали.

CREATE TABLE IF NOT EXISTS new_parts_checkout_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(32) NOT NULL DEFAULT 'awaiting_payment',
    amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
    order_payload TEXT NOT NULL DEFAULT '{}',
    cart_snapshot TEXT NOT NULL DEFAULT '[]',
    garage_order_id INTEGER REFERENCES garage_new_orders(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_np_checkout_sessions_user_id ON new_parts_checkout_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_np_checkout_sessions_status ON new_parts_checkout_sessions (status);

CREATE TABLE IF NOT EXISTS yookassa_payments (
    id VARCHAR(36) PRIMARY KEY,
    idempotence_key VARCHAR(36) NOT NULL UNIQUE,
    session_id VARCHAR(36) NOT NULL REFERENCES new_parts_checkout_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    yookassa_payment_id VARCHAR(64) UNIQUE,
    payment_method_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    amount_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount_currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
    paid_at TIMESTAMP WITH TIME ZONE,
    description VARCHAR(255),
    confirmation_type VARCHAR(32),
    confirmation_url TEXT,
    qr_payload TEXT,
    receipt_snapshot TEXT,
    payment_metadata TEXT,
    raw_create_response TEXT,
    raw_webhook_payload TEXT,
    captured BOOLEAN,
    refundable BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_yookassa_payments_session_id ON yookassa_payments (session_id);
CREATE INDEX IF NOT EXISTS ix_yookassa_payments_yk_id ON yookassa_payments (yookassa_payment_id);

ALTER TABLE garage_new_orders ADD COLUMN IF NOT EXISTS checkout_session_id VARCHAR(36);
ALTER TABLE garage_new_orders ADD COLUMN IF NOT EXISTS yookassa_payment_id VARCHAR(64);
