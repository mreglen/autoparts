-- Guest carts with 24h TTL support
CREATE TABLE IF NOT EXISTS guest_carts (
    id SERIAL PRIMARY KEY,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_guest_carts_token_hash ON guest_carts(token_hash);
CREATE INDEX IF NOT EXISTS ix_guest_carts_expires_at ON guest_carts(expires_at);

CREATE TABLE IF NOT EXISTS guest_new_parts_cart (
    id SERIAL PRIMARY KEY,
    guest_cart_id INTEGER NOT NULL REFERENCES guest_carts(id) ON DELETE CASCADE,
    brand VARCHAR(100) NOT NULL,
    partnumber VARCHAR(100) NOT NULL,
    name VARCHAR(255),
    delivery VARCHAR(255),
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(12,2) NOT NULL,
    stock_id VARCHAR(50) NOT NULL,
    guid VARCHAR(50),
    delivery_start TIMESTAMP,
    delivery_end TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_guest_new_parts_cart_guest_cart_id ON guest_new_parts_cart(guest_cart_id);
CREATE INDEX IF NOT EXISTS ix_guest_new_parts_cart_stock_id ON guest_new_parts_cart(stock_id);

CREATE TABLE IF NOT EXISTS guest_used_parts_cart (
    id SERIAL PRIMARY KEY,
    guest_cart_id INTEGER NOT NULL REFERENCES guest_carts(id) ON DELETE CASCADE,
    brand VARCHAR(100),
    partnumber VARCHAR(100),
    delivery VARCHAR(255),
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(12,2),
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_guest_used_parts_cart_guest_cart_id ON guest_used_parts_cart(guest_cart_id);
CREATE INDEX IF NOT EXISTS ix_guest_used_parts_cart_product_id ON guest_used_parts_cart(product_id);
