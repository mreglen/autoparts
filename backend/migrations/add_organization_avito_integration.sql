-- Интеграция Авито: ключи API и привязка к организации.
-- PostgreSQL. Повторный запуск безопасен (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS organization_avito_integration (
    organization_id VARCHAR(10) NOT NULL,
    avito_user_id BIGINT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT organization_avito_integration_pkey PRIMARY KEY (organization_id),
    CONSTRAINT organization_avito_integration_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES organizations (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE organization_avito_integration IS 'OAuth-ключи и ID пользователя Авито для автозагрузки';
