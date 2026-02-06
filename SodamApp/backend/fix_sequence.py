import psycopg2

conn = psycopg2.connect('postgresql://sodamfn_user:AZpKIEO9MxmPCCvkjRqsJqr4NBInwDw7@dpg-d62p07m3jp1c738r0cdg-a.singapore-postgres.render.com/sodamfn')
cur = conn.cursor()

# Fix Expense table sequence  
cur.execute("SELECT setval('expense_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM expense))")
print('Expense sequence reset')

# Fix DailyExpense sequence
cur.execute("SELECT setval('dailyexpense_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM dailyexpense))")
print('DailyExpense sequence reset')

# Fix Vendor sequence
cur.execute("SELECT setval('vendor_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM vendor))")
print('Vendor sequence reset')

conn.commit()
cur.close()
conn.close()
print('Done!')
