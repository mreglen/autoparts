-- Permissions for employee work zone filtering and calendar sync
INSERT INTO permissions (code, name)
SELECT 'autoservice.inspections.own', 'Записи на осмотр: только свои'
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'autoservice.inspections.own'
);

INSERT INTO permissions (code, name)
SELECT 'autoservice.inspections.assign_zones', 'Рабочие зоны: назначение сотрудникам'
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'autoservice.inspections.assign_zones'
);

INSERT INTO permissions (code, name)
SELECT 'autoservice.inspections.calendar_create', 'Записи на осмотр: создание из календаря'
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'autoservice.inspections.calendar_create'
);
