import sqlite3
db_path = "sodam_database.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print([t[0] for t in tables])
conn.close()
