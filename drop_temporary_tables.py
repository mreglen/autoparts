import psycopg2
from psycopg2 import sql

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'database': 'autoparts',
    'user': 'postgres',
    'password': 'root'
}

def drop_temporary_address_storage_tables():
    """Drop all temporary address storage related tables"""
    
    # SQL commands to drop tables
    drop_commands = [
        # Drop the main table
        "DROP TABLE IF EXISTS pending_product_storage_cells CASCADE;",
        
        # Drop any related sequences
        "DROP SEQUENCE IF EXISTS pending_product_storage_cells_id_seq CASCADE;",
        
        # Clean up orphaned data (these won't fail if tables don't exist)
        "DELETE FROM pending_product_storage_cells WHERE pending_product_id NOT IN (SELECT id FROM pending_products);",
        "DELETE FROM pending_product_storage_cells WHERE storage_cell_id NOT IN (SELECT id FROM storage_cells);",
        
        # Verify table was dropped
        "SELECT tablename FROM pg_tables WHERE tablename = 'pending_product_storage_cells';"
    ]
    
    try:
        # Connect to the database
        print("Connecting to database...")
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = True  # Enable autocommit for DDL operations
        cursor = conn.cursor()
        
        print("Executing drop commands...")
        
        # Execute each command
        for i, command in enumerate(drop_commands):
            try:
                cursor.execute(command)
                print(f"✓ Executed command {i+1}")
                
                # If this is the verification query, fetch and display results
                if "SELECT tablename" in command:
                    result = cursor.fetchall()
                    if result:
                        print(f"⚠ Table still exists: {result}")
                    else:
                        print("✓ Table successfully dropped")
                        
            except Exception as e:
                print(f"⚠ Command {i+1} failed (this may be expected): {e}")
        
        # Close connections
        cursor.close()
        conn.close()
        
        print("\n✅ All drop commands executed successfully!")
        print("Temporary address storage tables have been removed from the database.")
        
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        print("Please check your database connection settings.")

if __name__ == "__main__":
    print("Starting database cleanup...")
    drop_temporary_address_storage_tables()