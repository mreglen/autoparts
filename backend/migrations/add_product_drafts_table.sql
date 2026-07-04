-- Personal product drafts (per user)
CREATE TABLE IF NOT EXISTS product_drafts (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR NOT NULL REFERENCES organizations(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    article VARCHAR(30),
    name VARCHAR(255),
    brand VARCHAR(100),
    description TEXT,
    is_new BOOLEAN DEFAULT TRUE,
    price NUMERIC(12, 2),
    quantity INTEGER,
    storage_location_id INTEGER REFERENCES storage_locations(id),
    part_type_id INTEGER REFERENCES part_types(id),
    photos TEXT,
    videos TEXT,
    vehicle_ids TEXT,
    storage_cells_json TEXT
);

CREATE INDEX IF NOT EXISTS ix_product_drafts_org ON product_drafts (organization_id);
CREATE INDEX IF NOT EXISTS ix_product_drafts_user ON product_drafts (created_by);
