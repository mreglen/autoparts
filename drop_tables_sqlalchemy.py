import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import text
from backend.app.db.database import engine

def drop_temporary_address_storage_tables():
    """Drop all temporary address storage related tables using SQLAlchemy"""
    
    # SQL commands to drop tables
    drop_commands = [
        # Drop the main table with CASCADE to remove dependent objects
        "DROP TABLE IF EXISTS pending_product_storage_cells CASCADE;",
        
        # Drop any related sequences
        "DROP SEQUENCE IF EXISTS pending_product_storage_cells_id_seq CASCADE;",
        
        # Optional: Clean up any orphaned data in related tables
        # Note: These will fail silently if the table doesn't exist
        """DELETE FROM pending_product_storage_cells 
           WHERE pending_product_id NOT IN (SELECT id FROM pending_products);""",
        
        """DELETE FROM pending_product_storage_cells 
           WHERE storage_cell_id NOT IN (SELECT id FROM storage_cells);""",
    ]
    
    try:
        print("Connecting to database...")
        
        # Execute each command
        with engine.connect() as conn:
            for i, command in enumerate(drop_commands):
                try:
                    print(f"Executing command {i+1}...")
                    result = conn.execute(text(command))
                    conn.commit()
                    print(f"✓ Command {i+1} executed successfully")
                    
                except Exception as e:
                    print(f"⚠ Command {i+1} failed (this may be expected): {e}")
            
            # Verify table was dropped
            try:
                result = conn.execute(text(
                    "SELECT tablename FROM pg_tables WHERE tablename = 'pending_product_storage_cells';"
                ))
                remaining_tables = result.fetchall()
                
                if remaining_tables:
                    print(f"⚠ Table still exists: {remaining_tables}")
                else:
                    print("✓ Table successfully dropped")
                    
            except Exception as e:
                print(f"⚠ Verification failed: {e}")
        
        print("\n✅ Database cleanup completed!")
        print("Temporary address storage tables have been removed.")
        
    except Exception as e:
        print(f"❌ Error during database cleanup: {e}")
        print("Please check your database connection.")

if __name__ == "__main__":
    print("Starting database cleanup using SQLAlchemy...")
    drop_temporary_address_storage_tables()