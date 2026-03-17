# Database Migration Instructions for Production Server

## Problem
The `product_videos` table on the production server is missing the `created_at` and `updated_at` columns that were added to the SQLAlchemy model.

## Error
```
sqlalchemy.exc.ProgrammingError: (psycopg2.errors.UndefinedColumn) 
column product_videos.created_at does not exist
```

---

## Solution: Run the Migration Script

### Option 1: Using psql command line (Recommended)

```bash
# Connect to your production server
ssh vm2512296768

# Navigate to backend directory
cd /home/fast/autoparts/backend

# Run the migration script
psql -U postgres -d autoparts < migrations/add_updated_at_to_product_videos.sql
```

Or if you need to specify host/port:
```bash
psql -h localhost -U postgres -d autoparts < migrations/add_updated_at_to_product_videos.sql
```

---

### Option 2: Run SQL commands manually via psql

```bash
# Connect to database
psql -U postgres -d autoparts

# Then paste these commands:
ALTER TABLE product_videos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE product_videos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_product_videos_updated_at ON product_videos(updated_at);
UPDATE product_videos SET created_at = NOW() WHERE created_at IS NULL;
UPDATE product_videos SET updated_at = NOW() WHERE updated_at IS NULL;
```

Press `Ctrl+D` to exit psql when done.

---

### Option 3: Via Python script

If you prefer, create a quick Python script:

```python
# File: migrate.py
from sqlalchemy import create_engine, text

# Your production database URL
DATABASE_URL = "postgresql://postgres:root@localhost/autoparts"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE product_videos ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        ALTER TABLE product_videos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        CREATE INDEX IF NOT EXISTS idx_product_videos_updated_at ON product_videos(updated_at);
        UPDATE product_videos SET created_at = NOW() WHERE created_at IS NULL;
        UPDATE product_videos SET updated_at = NOW() WHERE updated_at IS NULL;
    """))
    conn.commit()
    print("✅ Migration completed successfully!")
```

Then run:
```bash
cd /home/fast/autoparts/backend
python migrate.py
```

---

## Verify Migration

After running the migration, verify the columns exist:

```bash
psql -U postgres -d autoparts -c "\d product_videos"
```

You should see output like:
```
Table "public.product_videos"
     Column      |           Type           | Collation | Nullable |              Default              
-----------------+--------------------------+-----------+----------+------------------------------------
 id              | integer                  |           | not null | nextval('product_videos_id_seq'::regclass)
 product_id      | integer                  |           |          | 
 video_url       | text                     |           | not null | 
 organization_id | character varying        |           |          | 
 processing_status | character varying(20)  |           |          | 'pending'::character varying
 created_at      | timestamp with time zone |           |          | now()
 updated_at      | timestamp with time zone |           |          | now()
```

---

## Restart Application

After migration, restart your FastAPI application:

```bash
# Depends on how you run it. For example:
sudo systemctl restart autoparts-backend

# Or if using uvicorn directly:
pkill -f uvicorn
cd /home/fast/autoparts/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
```

---

## Test

Try accessing the products endpoint again:
```bash
curl http://localhost:8000/api/products/
```

The error should be gone! ✅
