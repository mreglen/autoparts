-- Add part_type_id to rejected_products for resubmit flow
ALTER TABLE rejected_products
ADD COLUMN IF NOT EXISTS part_type_id INTEGER REFERENCES part_types(id);
