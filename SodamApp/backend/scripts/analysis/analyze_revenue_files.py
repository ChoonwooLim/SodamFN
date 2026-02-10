"""Quick card company analysis."""
import pandas as pd
from collections import Counter

FILE_A = r'C:\WORK\SodamFN\2026소득분석\매출\1월_일자별_신용카드 매출내역_20260209.xlsx'
df = pd.read_excel(FILE_A, header=0)

with open('card_analysis.txt', 'w', encoding='utf-8') as f:
    f.write("카드사명:\n")
    for c, cnt in Counter(df['카드사명'].dropna()).most_common():
        f.write(f"  {c}: {cnt}\n")
    
    f.write("\n매입사명:\n")
    for c, cnt in Counter(df['매입사명'].dropna()).most_common():
        f.write(f"  {c}: {cnt}\n")
    
    f.write(f"\n구분:\n")
    for t, cnt in Counter(df['구분'].dropna()).most_common():
        f.write(f"  {t}: {cnt}\n")

    # Aggregate by 매입사명 - filter out summary rows
    daily = {}
    for _, row in df.iterrows():
        buyer = str(row['매입사명']).strip() if pd.notna(row['매입사명']) else None
        if buyer is None or buyer == 'nan':
            continue
        amt_raw = row['승인금액']
        if pd.isna(amt_raw):
            continue
        try:
            amt = int(float(str(amt_raw).replace(',', '')))
        except:
            continue
        tx = str(row['구분']).strip()
        if tx == '취소': amt = -amt
        daily[buyer] = daily.get(buyer, 0) + amt
    
    f.write(f"\nTotal by 매입사명:\n")
    for b, t in sorted(daily.items(), key=lambda x: -x[1]):
        f.write(f"  {b}: {t:,}\n")
    f.write(f"\nGrand: {sum(daily.values()):,}\n")

print("Written to card_analysis.txt")
