from sqlmodel import Session, select, create_engine
from models import Staff

engine = create_engine('sqlite:///sodam_database.db')

with Session(engine) as session:
    staffs = session.exec(select(Staff)).all()
    print("ID | Name | Contract Type")
    print("---|---|---")
    for s in staffs:
        print(f"{s.id} | {s.name} | {s.contract_type}")
