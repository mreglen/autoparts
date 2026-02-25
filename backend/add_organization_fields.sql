ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS logo_organization TEXT;


ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS description TEXT;