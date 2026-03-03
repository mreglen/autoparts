-- Migration script to add organization_id and processing_status to product_photos table
-- Run this script to update your database schema

-- Add organization_id column
ALTER TABLE product_photos 
ADD COLUMN organization_id VARCHAR(10),
ADD COLUMN processing_status VARCHAR(20) DEFAULT 'pending';

-- Create index on organization_id for better query performance
CREATE INDEX idx_product_photos_organization_id ON product_photos(organization_id);

-- Add foreign key constraint
ALTER TABLE product_photos 
ADD CONSTRAINT fk_product_photos_organization 
FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- Update existing photos with organization_id from their product
UPDATE product_photos pp
SET organization_id = (
    SELECT p.organization_id 
    FROM products p 
    WHERE p.id = pp.product_id
)
WHERE pp.organization_id IS NULL;

-- Set default processing_status for existing photos
UPDATE product_photos 
SET processing_status = 'completed' 
WHERE processing_status IS NULL OR processing_status = 'pending';
