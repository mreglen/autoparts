-- TecDoc columns, vehicle_vins / vehicle_mileages, migrate VIN & mileage off vehicles.
-- Run manually against your PostgreSQL database when deploying.

CREATE TABLE IF NOT EXISTS vehicle_vins (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  vin VARCHAR(17) NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicle_mileages (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  mileage INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_vehicle_vins_vin ON vehicle_vins (vin);

-- Move existing data (idempotent if columns already dropped — run once before DROP)
INSERT INTO vehicle_vins (vehicle_id, vin)
SELECT id, TRIM(vin) FROM vehicles
WHERE vin IS NOT NULL AND TRIM(vin) <> ''
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO vehicle_mileages (vehicle_id, mileage)
SELECT id, mileage FROM vehicles
WHERE mileage IS NOT NULL
ON CONFLICT (vehicle_id) DO NOTHING;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tecdoc_manufacturer_id INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tecdoc_model_id INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tecdoc_passengercar_id INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tecdoc_engine_id INTEGER;

ALTER TABLE vehicles DROP COLUMN IF EXISTS vin;
ALTER TABLE vehicles DROP COLUMN IF EXISTS mileage;
