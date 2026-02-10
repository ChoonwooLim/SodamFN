"""Analyze 배민 encrypted xlsx files"""
import msoffcrypto, io, openpyxl, os

BASE = r"C:\WORK\SodamFN\2026소득분석\매출\배달앱매출\배민"
files = sorted(os.listdir(BASE))

for fname in files:
    fpath = os.path.join(BASE, fname)
    sep = "=" * 60
    print(f"\n{sep}")
    print(f"  FILE: {fname}")
    print(sep)
    try:
        with open(fpath, 'rb') as f:
            ms = msoffcrypto.OfficeFile(f)
            if ms.is_encrypted():
                ms.load_key(password='')
                decrypted = io.BytesIO()
                ms.decrypt(decrypted)
                decrypted.seek(0)
                wb = openpyxl.load_workbook(decrypted, data_only=True)
            else:
                wb = openpyxl.load_workbook(fpath, data_only=True)
        for sn in wb.sheetnames:
            ws = wb[sn]
            print(f"\n  Sheet: {sn} - Rows: {ws.max_row}, Cols: {ws.max_column}")
            for r_idx, row in enumerate(ws.iter_rows(values_only=True), 1):
                vals = [str(v) if v is not None else '' for v in row]
                if all(v == '' for v in vals):
                    continue
                print(f"  Row {r_idx}: {vals}")
                if r_idx >= 60:
                    print("  ...(truncated)")
                    break
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
