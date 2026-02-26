"""
Migration: Add vendor info fields and product image_url
- Vendor: phone, address, business_reg_number
- Product: image_url

Supports both SQLite and PostgreSQL via DATABASE_URL
Target: Orbitron PostgreSQL (192.168.219.101:5432/sodamfn)
"""
import os
import sys

# Add backend to path so dotenv can find .env
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    DATABASE_URL = "sqlite:///sodam_database.db"

from sqlalchemy import create_engine, text, inspect

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

def migrate():
    print(f"📦 Database: {'PostgreSQL' if 'postgresql' in DATABASE_URL else 'SQLite'}")
    
    # Mask password in URL for display
    display_url = DATABASE_URL
    if '@' in display_url:
        parts = display_url.split('@')
        display_url = '***@' + parts[-1]
    print(f"🔗 Connection: {display_url}")
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        
        # === Vendor table: phone, address, business_reg_number ===
        vendor_columns = [col['name'] for col in inspector.get_columns('vendor')]
        print(f"\n📋 Vendor table columns: {len(vendor_columns)}")
        
        new_vendor_cols = {
            'phone': 'VARCHAR',
            'address': 'VARCHAR',
            'business_reg_number': 'VARCHAR',
        }
        
        for col_name, col_type in new_vendor_cols.items():
            if col_name not in vendor_columns:
                conn.execute(text(f"ALTER TABLE vendor ADD COLUMN {col_name} {col_type}"))
                print(f"  ✅ Added '{col_name}' to vendor")
            else:
                print(f"  ℹ️  '{col_name}' already exists in vendor")
        
        # === Product table: image_url ===
        product_columns = [col['name'] for col in inspector.get_columns('product')]
        print(f"\n📋 Product table columns: {len(product_columns)}")
        
        if 'image_url' not in product_columns:
            conn.execute(text("ALTER TABLE product ADD COLUMN image_url VARCHAR"))
            print(f"  ✅ Added 'image_url' to product")
        else:
            print(f"  ℹ️  'image_url' already exists in product")
        
        conn.commit()
    
    print(f"\n🎉 Migration completed successfully!")

if __name__ == "__main__":
    migrate()
