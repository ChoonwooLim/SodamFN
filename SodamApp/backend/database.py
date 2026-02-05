from sqlmodel import SQLModel, create_engine, Session
import os

# Check for DATABASE_URL environment variable (Render provides this)
# If not found, fall back to local SQLite
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    # SQLAlchemy requires postgresql:// scheme
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    sqlite_file_name = "sodam_database.db"
    DATABASE_URL = f"sqlite:///{sqlite_file_name}"
    connect_args = {"check_same_thread": False} # SQLite specific
else:
    connect_args = {} # Postgres doesn't need this

DEBUG_SQL = os.environ.get("DEBUG_SQL", "false").lower() == "true"
engine = create_engine(
    DATABASE_URL, 
    echo=DEBUG_SQL, 
    connect_args=connect_args,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
