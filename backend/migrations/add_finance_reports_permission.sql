-- Permission for finance reports page (stage 5).
INSERT INTO permissions (code, name)
SELECT 'finance.reports', 'Финансовые отчёты'
WHERE NOT EXISTS (
    SELECT 1 FROM permissions WHERE code = 'finance.reports'
);
