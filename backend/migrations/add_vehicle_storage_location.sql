-- Привязка автомобиля к складу организации.
-- Выполнить один раз на сервере.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS storage_location_id INTEGER
  REFERENCES storage_locations(id) ON DELETE SET NULL;
