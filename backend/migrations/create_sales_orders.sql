BEGIN;

-- Garage (used parts)
CREATE TABLE IF NOT EXISTS garage_used_orders (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
    buyer_name VARCHAR(255) NOT NULL DEFAULT '',
    buyer_phone VARCHAR(50) NOT NULL DEFAULT '',
    buyer_email VARCHAR(255) NOT NULL DEFAULT '',
    delivery_type VARCHAR(50) NOT NULL DEFAULT 'transport',
    delivery_address TEXT NULL,
    transport_company VARCHAR(255) NULL,
    pickup_address TEXT NULL,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    status_code VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_garage_used_orders_org ON garage_used_orders(organization_id);
CREATE INDEX IF NOT EXISTS ix_garage_used_orders_status ON garage_used_orders(status_code);
CREATE INDEX IF NOT EXISTS ix_garage_used_orders_created ON garage_used_orders(created_at);

CREATE TABLE IF NOT EXISTS garage_used_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES garage_used_orders(id) ON DELETE CASCADE,
    product_id INTEGER NULL REFERENCES products(id),
    name VARCHAR(255) NOT NULL DEFAULT '',
    brand VARCHAR(100) NULL,
    partnumber VARCHAR(100) NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DOUBLE PRECISION NOT NULL DEFAULT 0,
    status_code VARCHAR(50) NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS ix_garage_used_order_items_order ON garage_used_order_items(order_id);
CREATE INDEX IF NOT EXISTS ix_garage_used_order_items_product ON garage_used_order_items(product_id);

-- Garage (new parts)
CREATE TABLE IF NOT EXISTS garage_new_orders (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
    buyer_name VARCHAR(255) NOT NULL DEFAULT '',
    buyer_phone VARCHAR(50) NOT NULL DEFAULT '',
    buyer_email VARCHAR(255) NOT NULL DEFAULT '',
    delivery_type VARCHAR(50) NOT NULL DEFAULT 'transport',
    delivery_address TEXT NULL,
    transport_company VARCHAR(255) NULL,
    pickup_address TEXT NULL,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    status_code VARCHAR(50) NOT NULL DEFAULT 'pending',
    seller VARCHAR(255) NULL,
    deliver_in_parts BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_garage_new_orders_org ON garage_new_orders(organization_id);
CREATE INDEX IF NOT EXISTS ix_garage_new_orders_status ON garage_new_orders(status_code);
CREATE INDEX IF NOT EXISTS ix_garage_new_orders_created ON garage_new_orders(created_at);

CREATE TABLE IF NOT EXISTS garage_new_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES garage_new_orders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    brand VARCHAR(100) NULL,
    partnumber VARCHAR(100) NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DOUBLE PRECISION NOT NULL DEFAULT 0,
    status_code VARCHAR(50) NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS ix_garage_new_order_items_order ON garage_new_order_items(order_id);

-- Avito orders cache
CREATE TABLE IF NOT EXISTS avito_orders_cache (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(10) NOT NULL REFERENCES organizations(id),
    avito_order_id VARCHAR(64) NOT NULL,
    avito_status_code VARCHAR(50) NULL,
    avito_data JSONB NULL,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ix_avito_orders_cache_org ON avito_orders_cache(organization_id);
CREATE INDEX IF NOT EXISTS ix_avito_orders_cache_status ON avito_orders_cache(avito_status_code);
CREATE INDEX IF NOT EXISTS ix_avito_orders_cache_created ON avito_orders_cache(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_avito_orders_cache_org_order ON avito_orders_cache(organization_id, avito_order_id);

COMMIT;

