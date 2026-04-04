-- Recreate vehicles + vehicle_photos with TecDoc JSONB, price, created_by.
-- Run manually on PostgreSQL when deploying (e.g. after dropping vehicles).

ALTER TABLE IF EXISTS product_vehicle_association
  DROP CONSTRAINT IF EXISTS product_vehicle_association_vehicle_id_fkey;

DROP TABLE IF EXISTS vehicle_photos CASCADE;
DROP TABLE IF EXISTS vehicle_vins CASCADE;
DROP TABLE IF EXISTS vehicle_mileages CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;

CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  generation VARCHAR(50),
  engine VARCHAR(50),
  transmission VARCHAR(30),
  organization_id VARCHAR(10) REFERENCES organizations(id),
  tecdoc_manufacturer_id INTEGER,
  tecdoc_model_id INTEGER,
  tecdoc_passengercar_id INTEGER,
  tecdoc_engine_id INTEGER,
  price NUMERIC(12,2),
  created_by INTEGER NOT NULL REFERENCES users(id),
  tecdoc_manufacturer_json JSONB,
  tecdoc_model_json JSONB,
  tecdoc_passengercar_json JSONB,
  tecdoc_engine_json JSONB,
  tecdoc_transmission_json JSONB
);

CREATE INDEX ix_vehicles_organization_id ON vehicles (organization_id);

CREATE TABLE vehicle_vins (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  vin VARCHAR(17) NOT NULL
);

CREATE INDEX ix_vehicle_vins_vin ON vehicle_vins (vin);

CREATE TABLE vehicle_mileages (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  mileage BIGINT NOT NULL
);

CREATE TABLE vehicle_photos (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  organization_id VARCHAR(10) REFERENCES organizations(id),
  photo_path TEXT NOT NULL,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX ix_vehicle_photos_vehicle_id ON vehicle_photos (vehicle_id);
CREATE INDEX ix_vehicle_photos_organization_id ON vehicle_photos (organization_id);

ALTER TABLE product_vehicle_association
  ADD CONSTRAINT product_vehicle_association_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
