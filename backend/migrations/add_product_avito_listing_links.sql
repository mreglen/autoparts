CREATE TABLE IF NOT EXISTS product_avito_listing_links (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(10) NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,
    avito_ad_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_avito_listing_org_ad
    ON product_avito_listing_links (organization_id, avito_ad_id);

CREATE INDEX IF NOT EXISTS ix_product_avito_listing_links_product_id
    ON product_avito_listing_links (product_id);
