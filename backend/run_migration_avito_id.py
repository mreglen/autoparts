"""
Migration script to add avito_id column to product_avito_listing_links table
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.db.database import engine

def run_migration():
    """Execute the migration to add avito_id column"""
    migration_sql = """
    ALTER TABLE product_avito_listing_links ADD COLUMN IF NOT EXISTS avito_id VARCHAR(64);
    CREATE INDEX IF NOT EXISTS idx_product_avito_listing_avito_id ON product_avito_listing_links(avito_id);
    """
    
    print("Running migration: add avito_id column to product_avito_listing_links")
    
    try:
        with engine.connect() as conn:
            conn.execute(text(migration_sql))
            conn.commit()
        print("✅ Migration completed successfully!")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    run_migration()
