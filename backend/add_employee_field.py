import os
import sys
from sqlalchemy import create_engine, text
from app.core.config import Settings

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def add_is_employee_column():
    settings = Settings()
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'is_employee'
        """))
        
        if result.fetchone():
            print("Column 'is_employee' already exists")
            return
        
        # Add the column
        conn.execute(text("ALTER TABLE users ADD COLUMN is_employee BOOLEAN DEFAULT FALSE"))
        conn.commit()
        print("Column 'is_employee' added successfully")

if __name__ == "__main__":
    add_is_employee_column()