-- Public user codes for audit UI and support (internal users.id unchanged).
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_code VARCHAR(10);

UPDATE users
SET public_code = (1000000 + id)::text
WHERE public_code IS NULL OR TRIM(public_code) = '';

ALTER TABLE users ALTER COLUMN public_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_public_code ON users (public_code);
