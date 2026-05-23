-- Permission for Avito integration settings (/settings/integration, /settings/integration/avito).
INSERT INTO permissions (code, name)
SELECT 'settings.integration.avito', 'Интеграция Авито'
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'settings.integration.avito'
);
