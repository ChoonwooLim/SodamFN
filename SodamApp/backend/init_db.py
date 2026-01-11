from sqlmodel import SQLModel, select
from database import engine
from models import User
from services.database_service import DatabaseService
from routers.auth import get_password_hash

def init_db():
    print("Creating tables...")
    SQLModel.metadata.create_all(engine)
    
    service = DatabaseService()
    try:
        # Check if admin already exists
        stmt = select(User).where(User.username == "admin")
        admin = service.session.exec(stmt).first()
        
        if not admin:
            print("Creating initial admin user...")
            admin_user = User(
                username="admin",
                hashed_password=get_password_hash("admin1234"),
                role="admin"
            )
            service.session.add(admin_user)
            service.session.commit()
            print("Admin user created: username=admin, password=admin1234")
        else:
            print("Admin user already exists.")
    finally:
        service.close()

if __name__ == "__main__":
    init_db()
