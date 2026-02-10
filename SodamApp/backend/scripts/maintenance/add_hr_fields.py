from sqlmodel import Session, text
from database import engine

def migrate_hr_fields():
    with Session(engine) as session:
        # Define columns and types
        columns = [
            ("phone", "VARCHAR"),
            ("contract_type", "VARCHAR DEFAULT '아르바이트'"),
            ("insurance_4major", "BOOLEAN DEFAULT 0"),
            ("monthly_salary", "INTEGER DEFAULT 0"),
            ("work_schedule", "VARCHAR"),
            ("doc_contract", "BOOLEAN DEFAULT 0"),
            ("doc_health_cert", "BOOLEAN DEFAULT 0"),
            ("doc_id_copy", "BOOLEAN DEFAULT 0"),
            ("doc_bank_copy", "BOOLEAN DEFAULT 0")
        ]
        
        for col_name, col_type in columns:
            try:
                sql = f"ALTER TABLE staff ADD COLUMN {col_name} {col_type}"
                session.exec(text(sql))
                print(f"Added column: {col_name}")
            except Exception as e:
                print(f"Skipping {col_name} (likely exists): {e}")
                
        session.commit()
        print("HR Fields Migration Complete.")

if __name__ == "__main__":
    migrate_hr_fields()
