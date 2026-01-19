import pandas as pd
from datetime import datetime
import re

def parse_sales_approval(file):
    """
    Parses '매출승인내역' Excel from CREFIA.
    Returns list of dicts: [ {approval_date, approval_time, card_corp, card_number, approval_number, amount, installment, status, shop_name} ]
    """
    try:
        # Load Excel (skip header rows if needed - CREFIA usually has 1-2 header rows)
        # Using header=0 to auto-detect. We will look for specific columns.
        df = pd.read_excel(file.file)
        
        # Identify header row index if not 0
        header_row = 0
        for i, row in df.head(10).iterrows():
            row_str = " ".join([str(x) for x in row.values])
            if "승인일자" in row_str and "승인번호" in row_str:
                header_row = i
                break
                
        df = pd.read_excel(file.file, header=header_row)
        
        results = []
        for _, row in df.iterrows():
            # Validate row
            if pd.isna(row.get("승인일자")) or str(row.get("승인일자")).strip() == "":
                continue

            # Parse Date
            date_str = str(row.get("승인일자")).strip()
            # Handle YYYY-MM-DD or YYYYMMDD
            try:
                if "-" in date_str:
                    approval_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                else:
                    approval_date = datetime.strptime(date_str, "%Y%m%d").date()
            except:
                continue # Skip invalid dates (totals etc)

            amount_raw = row.get("승인금액", 0)
            try:
                amount = int(str(amount_raw).replace(",", "").replace("원", ""))
            except:
                amount = 0

            results.append({
                "approval_date": approval_date,
                "approval_time": str(row.get("승인시간", "")).strip(),
                "card_corp": str(row.get("카드사명", row.get("매입카드사", "Unknown"))).strip(),
                "card_number": str(row.get("카드번호", "")).strip(),
                "approval_number": str(row.get("승인번호", "")).strip(),
                "amount": amount,
                "installment": str(row.get("할부기간", "일시불")).strip(),
                "status": str(row.get("승인구분", "승인")).strip(),
                "shop_name": str(row.get("가맹점명", "")).strip()
            })
            
        return results
    except Exception as e:
        print(f"Error parsing sales approval: {e}")
        return []

def parse_payment_history(file):
    """
    Parses '매입(입금)내역 detail' Excel.
    Returns list of dicts for CardPayment.
    """
    try:
        df = pd.read_excel(file.file)
        
        header_row = 0
        for i, row in df.head(10).iterrows():
            row_str = " ".join([str(x) for x in row.values])
            if "지급일자" in row_str or "입금일자" in row_str:
                header_row = i
                break
                
        df = pd.read_excel(file.file, header=header_row)
        
        results = []
        for _, row in df.iterrows():
            date_col = "지급일자" if "지급일자" in df.columns else "입금일자"
            if pd.isna(row.get(date_col)): continue
            
            date_str = str(row.get(date_col)).strip()
            try:
                payment_date = datetime.strptime(date_str.replace("-", ""), "%Y%m%d").date()
            except: continue
            
            # Helper to clean numbers
            def clean_num(key):
                try:
                    return int(str(row.get(key, 0)).replace(",", "").replace("원", ""))
                except:
                    return 0

            results.append({
                "payment_date": payment_date,
                "card_corp": str(row.get("카드사명", row.get("매입카드사", ""))).strip(),
                "sales_amount": clean_num("매출금액") if "매출금액" in df.columns else clean_num("승인금액"),
                "fees": clean_num("가맹점수수료") + clean_num("수수료"), # Sum if ambiguous
                "vat_on_fees": clean_num("부가세"),
                "net_deposit": clean_num("입금예정금액") if "입금예정금액" in df.columns else clean_num("실지급액"),
                "bank": str(row.get("입금은행", "")).strip()
            })
            
        return results

    except Exception as e:
        print(f"Error parsing payment history: {e}")
        return []
