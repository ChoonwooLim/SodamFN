"""Full dump of 땡겨요 file structure."""
import pandas as pd, io

f_path = r"C:\WORK\SodamFN\2026소득분석\매출\2월\땡겨요 정산내역(2월건별).xls"

with open(f_path, "rb") as f:
    content = f.read()

df = pd.read_excel(io.BytesIO(content), header=None, engine='xlrd')
print(f"Shape: {df.shape}")

for i in range(len(df)):
    row_vals = [str(v) if pd.notna(v) else '' for v in df.iloc[i].tolist()]
    non_empty = [v for v in row_vals if v.strip()]
    if non_empty:
        print(f"  [{i}] {' | '.join(non_empty[:8])}")
