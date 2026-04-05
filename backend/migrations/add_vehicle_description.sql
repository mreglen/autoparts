-- Описание автомобиля (текст под фото в карточке ТС).
-- Выполнить один раз на сервере, если в логах: column vehicles.description does not exist

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS description TEXT;
