from sqlmodel import Session, select, text
from database import engine
from models import Staff, Payroll

def update_status():
    with Session(engine) as session:
        # 1. Add Column (Schema Migration)
        try:
            session.exec(text("ALTER TABLE staff ADD COLUMN status VARCHAR DEFAULT '재직'"))
            session.commit()
            print("Added 'status' column to Staff table.")
        except Exception as e:
            print(f"Column might already exist or error: {e}")
            session.rollback()

        # 2. Identify Active Staff (Present in Dec Payroll)
        # Assuming 2025-12 is the key
        stmt = select(Payroll.staff_id).where(Payroll.month == "2025-12").distinct()
        active_ids = session.exec(stmt).all()
        # Ensure ids are integers
        active_ids = [id for id in active_ids if id is not None]
        
        print(f"Active Staff IDs (Dec Payroll): {active_ids}")
        
        # 3. Update Staff Status
        all_staff = session.exec(select(Staff)).all()
        count_resigned = 0
        
        for staff in all_staff:
            if staff.id in active_ids:
                staff.status = "재직"
            else:
                staff.status = "퇴사"
                count_resigned += 1
            session.add(staff)
            
        session.commit()
        print(f"Updated Staff Status. Resigned count: {count_resigned}")

if __name__ == "__main__":
    update_status()
