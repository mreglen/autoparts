-- Кэш последнего разобранного XLSX автозагрузки (таблица на странице интеграции).
-- PostgreSQL.

CREATE TABLE IF NOT EXISTS organization_avito_autoload_cache (
    organization_id VARCHAR(10) NOT NULL,
    items_json TEXT NOT NULL DEFAULT '[]',
    saved_path VARCHAR(512),
    local_validation_ok BOOLEAN NOT NULL DEFAULT TRUE,
    local_errors_json TEXT NOT NULL DEFAULT '[]',
    sheets_parsed_json TEXT NOT NULL DEFAULT '[]',
    avito_upload_json TEXT,
    avito_upload_status INTEGER,
    avito_report_json TEXT,
    avito_token_error TEXT,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT organization_avito_autoload_cache_pkey PRIMARY KEY (organization_id),
    CONSTRAINT organization_avito_autoload_cache_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES organizations (id)
        ON DELETE CASCADE
);
