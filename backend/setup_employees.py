import sys
import os

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from sqlalchemy import create_engine, text
from app.core.config import Settings

def setup_employee_role():
    settings = Settings()
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # First, add the is_employee column if it doesn't exist
        try:
            # Check if column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'is_employee'
            """))
            
            if not result.fetchone():
                print("Adding is_employee column...")
                conn.execute(text("ALTER TABLE users ADD COLUMN is_employee BOOLEAN DEFAULT FALSE"))
                print("Column added successfully")
            else:
                print("Column is_employee already exists")
            
            # Set some users as employees (those who belong to organizations but aren't directors/sellers/admins)
            print("Setting users as employees...")
            conn.execute(text("""
                UPDATE users 
                SET is_employee = TRUE 
                WHERE organization_id IS NOT NULL 
                AND is_director = FALSE 
                AND is_seller = FALSE 
                AND is_admin = FALSE
            """))
            
            # Commit the transaction
            conn.commit()
            
            # Show results
            result = conn.execute(text("""
                SELECT COUNT(*) as employee_count 
                FROM users 
                WHERE is_employee = TRUE
            """))
            
            count = result.fetchone()[0]
            print(f"Successfully set {count} users as employees")
            
        except Exception as e:
            print(f"Error: {e}")
            conn.rollback()

if __name__ == "__main__":
    setup_employee_role()