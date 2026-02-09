"""Verify 배민 password and read file structure"""
import msoffcrypto, io, openpyxl, os

fpath = r"C:\WORK\SodamFN\2026소득분석\매출\배달앱매출\배민\[배달의민족] HONG JI YEON 파트너님 2026년 1월 정산명세서.xlsx"
with open(fpath, 'rb') as f:
    ms = msoffcrypto.OfficeFile(f)
    print("Is encrypted:", ms.is_encrypted())
    ms.load_key(password='630730')
    decrypted = io.BytesIO()
    ms.decrypt(decrypted)
    decrypted.seek(0)
    wb = openpyxl.load_workbook(decrypted, data_only=True)
    for sn in wb.sheetnames:
        ws = wb[sn]
        print(f"\nSheet: {sn} — Rows: {ws.max_row}, Cols: {ws.max_column}")
        for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
            vals = [str(v) if v is not None else '' for v in row]
            if all(v == '' for v in vals):
                continue
            print(f"  Row {r_idx}: {vals}")
            if r_idx >= 50:
                print("  ...(truncated)")
                break
