-- Создаем таблицу видов запчастей
CREATE TABLE part_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Добавляем фиксированные значения
INSERT INTO part_types (name) VALUES 
    ('Автосвет'),
    ('Автомобиль на запчасти'),
    ('Аккумуляторы'),
    ('Двигатель'),
    ('Кузов'),
    ('Подвеска'),
    ('Рулевое управление'),
    ('Салон'),
    ('Система охлаждения'),
    ('Стёкла'),
    ('Топливная и выхлопная системы'),
    ('Тормозная система'),
    ('Трансмиссия и привод'),
    ('Электрооборудование');

-- Добавляем колонку part_type_id в таблицу products (nullable - необязательное поле)
ALTER TABLE products ADD COLUMN part_type_id INTEGER REFERENCES part_types(id);
