-- Пробег больше 2_147_483_647 не помещается в INTEGER PostgreSQL.
-- Выполнить один раз, если была ошибка NumericValueOutOfRange на vehicle_mileages.

ALTER TABLE vehicle_mileages
  ALTER COLUMN mileage TYPE BIGINT;
