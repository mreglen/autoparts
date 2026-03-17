#!/usr/bin/env python3
"""
Quick migration script to add created_at and updated_at columns to product_videos table.
Run this on your production server (vm2512296768).
"""

from sqlalchemy import create_engine, text
import sys

# Your production database URL
# Update this if your credentials are different
DATABASE_URL = "postgresql://postgres:root@localhost/autoparts"

def run_migration():
    print("🚀 Starting database migration...")
    print(f"📦 Database: {DATABASE_URL}")
    
    try:
        engine = create_engine(DATABASE_URL)
        
        with engine.connect() as conn:
            print("\n📝 Executing SQL commands...")
            
            # Add created_at column
            conn.execute(text("""
                ALTER TABLE product_videos 
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            """))
            print("✅ Added created_at column")
            
            # Add updated_at column
            conn.execute(text("""
                ALTER TABLE product_videos 
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            """))
            print("✅ Added updated_at column")
            
            # Create index for performance
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_product_videos_updated_at 
                ON product_videos(updated_at)
            """))
            print("✅ Created index on updated_at")
            
            # Update existing records
            conn.execute(text("""
                UPDATE product_videos 
                SET created_at = NOW() 
                WHERE created_at IS NULL
            """))
            print("✅ Updated created_at for existing records")
            
            conn.execute(text("""
                UPDATE product_videos 
                SET updated_at = NOW() 
                WHERE updated_at IS NULL
            """))
            print("✅ Updated updated_at for existing records")
            
            conn.commit()
            
            print("\n✅ Migration completed successfully!")
            print("🎉 All columns added and indexed")
            
            # Verify the changes
            result = conn.execute(text("""
                SELECT column_name, data_type, column_default 
                FROM information_schema.columns 
                WHERE table_name = 'product_videos' 
                AND column_name IN ('created_at', 'updated_at')
                ORDER BY column_name
            """)).fetchall()
            
            print("\n📊 Verification:")
            for row in result:
                print(f"   - {row[0]}: {row[1]} (default: {row[2]})")
            
            return True
            
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
