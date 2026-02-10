import psycopg2

DATABASE_URL = 'postgresql://sodamfn_user:AZpKIEO9MxmPCCvkjRqsJqr4NBInwDw7@dpg-d62p07m3jp1c738r0cdg-a.singapore-postgres.render.com/sodamfn'

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Get columns of monthlyprofitloss table
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'monthlyprofitloss'")
columns = cur.fetchall()
print('MonthlyProfitLoss columns:', [c[0] for c in columns])

cur.close()
conn.close()
