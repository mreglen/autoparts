INSERT INTO permissions (code, name)
SELECT 'admin.audit', 'Журнал событий'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'admin.audit');
