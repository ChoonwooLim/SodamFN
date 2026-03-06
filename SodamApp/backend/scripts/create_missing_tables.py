import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import SQLModel
from database import engine
import models

def create_tables():
    print("Creating missing tables...")
    SQLModel.metadata.create_all(engine)
    print("Done")

if __name__ == "__main__":
    create_tables()
