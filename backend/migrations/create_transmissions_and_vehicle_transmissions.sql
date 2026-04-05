-- Справочник типов КПП и связь с автомобилем (одна запись на авто).
-- Выполнить вручную на PostgreSQL при деплое.

CREATE TABLE IF NOT EXISTS transmissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vehicle_transmissions (
  vehicle_id INTEGER NOT NULL PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  transmission_id INTEGER NOT NULL REFERENCES transmissions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_vehicle_transmissions_transmission_id
  ON vehicle_transmissions (transmission_id);

INSERT INTO transmissions (name, sort_order) VALUES
  ('АКПП', 1),
  ('МКПП', 2),
  ('Вариатор', 3),
  ('Робот', 4)
ON CONFLICT (name) DO NOTHING;
