"""
Restore revenue data: create vendors + import from Excel files.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'SodamApp', 'backend'))

import pandas as pd
from sqlmodel import Session, select
from database import engine
from models import Vendor, DailyExpense
from datetime import datetime

STORE_NAME = "소담김밥"

# ── Step 1: Analyze Excel files ──
print("=" * 60)
print("Step 1: Analyzing Excel files")
print("=" * 60)

# Store sales file
store_file = r"C:\WORK\SodamFN\2026소득분석\매출\소담김밥매장 일자별 매출내역_20260209.xlsx"
df_store = pd.read_excel(store_file, header=None)
print(f"\n[매장매출] rows={len(df_store)}, cols={len(df_store.columns)}")
for i in range(min(3, len(df_store))):
    print(f"  Row {i}: {list(df_store.iloc[i].values)[:10]}")

# Card sales file
card_file = r"C:\WORK\SodamFN\2026소득분석\매출\1월_일자별_신용카드 매출내역_20260209.xlsx"
df_card = pd.read_excel(card_file, header=None)
print(f"\n[카드매출] rows={len(df_card)}, cols={len(df_card.columns)}")
for i in range(min(3, len(df_card))):
    print(f"  Row {i}: {list(df_card.iloc[i].values)[:10]}")

# Delivery files
delivery_dir = r"C:\WORK\SodamFN\2026소득분석\매출\배달앱매출"
for app_dir in os.listdir(delivery_dir):
    app_path = os.path.join(delivery_dir, app_dir)
    if os.path.isdir(app_path):
        files = os.listdir(app_path)
        print(f"\n[배달앱/{app_dir}] files: {files}")

print("\n\nDone analyzing. Check output above for column structure.")
