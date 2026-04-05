-- Глобальные настройки сайта (одна строка id = 1).
CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY,
    show_new_autoparts BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO site_settings (id, show_new_autoparts)
SELECT 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE id = 1);
