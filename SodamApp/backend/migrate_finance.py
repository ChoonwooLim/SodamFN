from sqlmodel import SQLModel, create_engine
from models import CardSalesApproval, CardPayment

# DB Connection
DATABASE_URL = "sqlite:///sodam_database.db"
engine = create_engine(DATABASE_URL)

def migrate():
    print("Migrating Card Sales & Payment tables...")
    SQLModel.metadata.create_all(engine)
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
