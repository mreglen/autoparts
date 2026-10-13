-- Permissions for detailed planner work zone rights
INSERT INTO permissions (code, name)
SELECT 'autoservice.planner.view', 'Планировщик: просмотр'
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'autoservice.planner.view'
);

INSERT INTO permissions (code, name)
SELECT 'autoservice.planner.edit', 'Планировщик: редактирование'
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'autoservice.planner.edit'
);

INSERT INTO permissions (code, name)
SELECT 'autoservice.planner.caldav', 'Планировщик: календарь'
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'autoservice.planner.caldav'
);
