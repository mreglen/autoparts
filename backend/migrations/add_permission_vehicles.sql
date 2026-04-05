-- Право «Автомобили» для сотрудников (код vehicles).
-- Дублирует логику _ensure_default_permissions в app/routers/employees.py — можно выполнить вручную.

INSERT INTO permissions (code, name)
SELECT 'vehicles', 'Автомобили'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'vehicles');
