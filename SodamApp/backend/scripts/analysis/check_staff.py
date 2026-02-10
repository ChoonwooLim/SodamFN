from sqlmodel import Session, select, create_engine
from models import Staff

engine = create_engine('sqlite:///sodam_database.db')

with Session(engine) as session:
    staffs = session.exec(select(Staff)).all()
    for s in staffs:
        print(f"ID: {s.id}, Name: {s.name}")
