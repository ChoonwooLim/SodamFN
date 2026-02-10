"""
Analyze each purchase file individually - output to file
"""
import os
import pandas as pd
import sys

FOLDER = r"C:\WORK\SodamFN\2026소득분석\매입"
OUTPUT = r"C:\WORK\SodamFN\purchase_analysis_output.txt"

files = sorted(os.listdir(FOLDER))

with open(OUTPUT, 'w', encoding='utf-8') as out:
    for idx, fname in enumerate(files):
        fpath = os.path.join(FOLDER, fname)
        if not os.path.isfile(fpath):
            continue
        
        out.write("=" * 90 + "\n")
        out.write(f"FILE {idx+1}/{len(files)}: {fname}\n")
        out.write(f"SIZE: {os.path.getsize(fpath):,} bytes\n")
        out.write("=" * 90 + "\n")
        
        # Check if file is actually HTML
        with open(fpath, 'rb') as f:
            header = f.read(500)
        
        is_html = b'<html' in header.lower() or b'<!doctype' in header.lower() or b'<table' in header.lower() or header.startswith(b'\r\n\r\n')
        
        if is_html:
            out.write(f"FORMAT: HTML disguised as .xls\n\n")
            try:
                dfs = pd.read_html(fpath, encoding='utf-8')
                out.write(f"TABLES FOUND: {len(dfs)}\n")
                for ti, df in enumerate(dfs):
                    out.write(f"\n  --- Table {ti+1} ---\n")
                    out.write(f"  Shape: {df.shape}\n")
                    out.write(f"  Columns: {list(df.columns)}\n")
                    pd.set_option('display.max_columns', 15)
                    pd.set_option('display.width', 200)
                    pd.set_option('display.max_colwidth', 30)
                    out.write(f"  FIRST 10 ROWS:\n")
                    out.write(df.head(10).to_string(index=True) + "\n")
                    out.write(f"\n  LAST 3 ROWS:\n")
                    out.write(df.tail(3).to_string(index=True) + "\n")
            except Exception as e:
                out.write(f"  HTML parse error: {e}\n")
                try:
                    dfs = pd.read_html(fpath, encoding='euc-kr')
                    out.write(f"  (euc-kr) TABLES FOUND: {len(dfs)}\n")
                    for ti, df in enumerate(dfs):
                        out.write(f"\n  --- Table {ti+1} ---\n")
                        out.write(f"  Shape: {df.shape}\n")
                        out.write(df.head(10).to_string(index=True) + "\n")
                except Exception as e2:
                    out.write(f"  euc-kr also failed: {e2}\n")
        else:
            out.write(f"FORMAT: Real Excel file\n\n")
            try:
                if fname.endswith('.xls'):
                    xls = pd.ExcelFile(fpath, engine='xlrd')
                else:
                    xls = pd.ExcelFile(fpath, engine='openpyxl')
                
                out.write(f"SHEETS: {xls.sheet_names}\n")
                for sheet in xls.sheet_names:
                    df = pd.read_excel(xls, sheet_name=sheet, header=None)
                    out.write(f"\n  --- Sheet: '{sheet}' ---\n")
                    out.write(f"  Shape: {df.shape}\n")
                    pd.set_option('display.max_columns', 15)
                    pd.set_option('display.width', 200)
                    pd.set_option('display.max_colwidth', 30)
                    out.write(f"  FIRST 10 ROWS:\n")
                    out.write(df.head(10).to_string(index=True) + "\n")
                    out.write(f"\n  LAST 3 ROWS:\n")
                    out.write(df.tail(3).to_string(index=True) + "\n")
            except Exception as e:
                out.write(f"  Excel parse error: {e}\n")
        
        out.write("\n\n\n")

print(f"Analysis complete! Output written to: {OUTPUT}")
