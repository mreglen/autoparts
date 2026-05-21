-- Public user code: one Latin letter + 6 digits (assigned via remigrate_user_public_codes.py).
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_code VARCHAR(10);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_public_code ON users (public_code);

-- After deploy run:
--   python backend/scripts/remigrate_user_public_codes.py
