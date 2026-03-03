"""
Database Migration Script for product_photos table
Run this to add organization_id and processing_status columns
"""

import psycopg2
from psycopg2 import sql

# Database connection settings
DB_CONFIG = {
    'dbname': 'autoparts',
    'user': 'postgres',
    'password': 'root',
    'host': 'localhost',
    'port': '5432'
}

def run_migration():
    """Apply the database migration"""
    
    print("=" * 60)
    print("Running Database Migration")
    print("=" * 60)
    
    try:
        # Connect to database
        print("\nConnecting to database...")
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False
        cursor = conn.cursor()
        print("✓ Connected successfully")
        
        # Check if columns already exist
        print("\nChecking existing columns...")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'product_photos' 
            AND column_name IN ('organization_id', 'processing_status')
        """)
        existing_columns = [row[0] for row in cursor.fetchall()]
        
        if 'organization_id' in existing_columns and 'processing_status' in existing_columns:
            print("⚠ Columns already exist. Skipping creation.")
        else:
            # Add new columns
            print("\nAdding new columns...")
            
            if 'organization_id' not in existing_columns:
                cursor.execute(sql.SQL("""
                    ALTER TABLE product_photos 
                    ADD COLUMN organization_id VARCHAR(10)
                """))
                print("✓ Added organization_id column")
            
            if 'processing_status' not in existing_columns:
                cursor.execute(sql.SQL("""
                    ALTER TABLE product_photos 
                    ADD COLUMN processing_status VARCHAR(20) DEFAULT 'pending'
                """))
                print("✓ Added processing_status column")
            
            conn.commit()
        
        # Check and create index
        print("\nCreating index...")
        cursor.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'product_photos' 
            AND indexname = 'idx_product_photos_organization_id'
        """)
        
        if not cursor.fetchone():
            cursor.execute(sql.SQL("""
                CREATE INDEX idx_product_photos_organization_id 
                ON product_photos(organization_id)
            """))
            print("✓ Created index on organization_id")
            conn.commit()
        else:
            print("⚠ Index already exists")
        
        # Check and create foreign key
        print("\nAdding foreign key constraint...")
        cursor.execute("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conname = 'fk_product_photos_organization'
        """)
        
        if not cursor.fetchone():
            cursor.execute(sql.SQL("""
                ALTER TABLE product_photos 
                ADD CONSTRAINT fk_product_photos_organization 
                FOREIGN KEY (organization_id) 
                REFERENCES organizations(id) ON DELETE SET NULL
            """))
            print("✓ Added foreign key constraint")
            conn.commit()
        else:
            print("⚠ Foreign key constraint already exists")
        
        # Update existing records
        print("\nUpdating existing records...")
        cursor.execute(sql.SQL("""
            UPDATE product_photos pp
            SET organization_id = (
                SELECT p.organization_id 
                FROM products p 
                WHERE p.id = pp.product_id
            )
            WHERE pp.organization_id IS NULL
        """))
        updated_count = cursor.rowcount
        print(f"✓ Updated {updated_count} existing photo records with organization_id")
        
        # Set default status for existing photos
        print("\nSetting processing status for existing photos...")
        cursor.execute(sql.SQL("""
            UPDATE product_photos 
            SET processing_status = 'completed' 
            WHERE processing_status IS NULL OR processing_status = 'pending'
        """))
        status_count = cursor.rowcount
        print(f"✓ Set processing_status to 'completed' for {status_count} records")
        
        conn.commit()
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        if conn:
            conn.rollback()
        return False
    
    return True

if __name__ == "__main__":
    success = run_migration()
    exit(0 if success else 1)
