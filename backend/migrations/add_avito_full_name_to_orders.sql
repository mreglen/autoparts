-- Миграция: исправление полей имени клиента из Авито
-- Дата: 2026-04-14
-- Описание: Замена avito_full_name на три нормализованных поля (last_name, first_name, patronymic)

-- Удаляем старое поле avito_full_name если существует
ALTER TABLE orders DROP COLUMN IF EXISTS avito_full_name;

-- Добавляем три новых поля для ФИО
ALTER TABLE orders ADD COLUMN IF NOT EXISTS avito_last_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS avito_first_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS avito_patronymic VARCHAR(100);

-- Комментарии
COMMENT ON COLUMN orders.avito_last_name IS 'Фамилия клиента из Авито';
COMMENT ON COLUMN orders.avito_first_name IS 'Имя клиента из Авито';
COMMENT ON COLUMN orders.avito_patronymic IS 'Отчество клиента из Авито';
