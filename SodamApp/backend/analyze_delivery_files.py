"""
Analyze delivery app revenue Excel files to understand their structure.
"""
import pandas as pd
import os
import glob

BASE_DIR = r"C:\WORK\SodamFN\2026소득분석\매출\배달앱매출"

channels = {
    "쿠팡": os.path.join(BASE_DIR, "쿠팡"),
    "배민": os.path.join(BASE_DIR, "배민"),
    "요기요": os.path.join(BASE_DIR, "요기요"),
    "땡겨요": os.path.join(BASE_DIR, "땡겨요"),
}

output_lines = []

def log(msg=""):
    output_lines.append(str(msg))
    print(msg)

for channel, folder in channels.items():
    log(f"\n{'='*80}")
    log(f"  CHANNEL: {channel}")
    log(f"  FOLDER: {folder}")
    log(f"{'='*80}")
    
    files = glob.glob(os.path.join(folder, "*.xls*"))
    files.sort()
    
    for filepath in files:
        fname = os.path.basename(filepath)
        log(f"\n--- FILE: {fname} ---")
        
        try:
            xls = pd.ExcelFile(filepath)
            log(f"  Sheets: {xls.sheet_names}")
            
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
                log(f"\n  Sheet: '{sheet_name}' — Shape: {df.shape}")
                log(f"  Columns count: {df.shape[1]}")
                
                # Show first 25 rows
                log(f"  --- First 25 rows ---")
                for i in range(min(25, len(df))):
                    row = df.iloc[i]
                    vals = [str(v) if pd.notna(v) else '' for v in row]
                    log(f"    Row {i}: {vals}")
                
                # Show last 5 rows
                if len(df) > 25:
                    log(f"  --- Last 5 rows ---")
                    for i in range(max(25, len(df)-5), len(df)):
                        row = df.iloc[i]
                        vals = [str(v) if pd.notna(v) else '' for v in row]
                        log(f"    Row {i}: {vals}")
        except Exception as e:
            log(f"  ERROR reading file: {e}")

# Write output
with open(os.path.join(os.path.dirname(__file__), "delivery_analysis_output.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(output_lines))

log("\n\nDone! Output saved to delivery_analysis_output.txt")
