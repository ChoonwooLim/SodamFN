import pandas as pd
from datetime import datetime
from io import BytesIO
import re

def parse_sales_approval(file):
    """
    Parses '매출승인내역' / '신용카드 매출내역' Excel from CREFIA or POS systems.
    Supports multiple column naming conventions.
    Returns list of dicts for CardSalesApproval.
    """
    try:
        # Read file bytes into memory once to avoid stream exhaustion
        file_bytes = BytesIO(file.file.read())
        
        # Load Excel
        df = pd.read_excel(file_bytes)
        
        # Identify header row index if not 0
        # Look for known column keywords in any of the first 10 rows
        header_row = 0
        date_keywords = ["승인일자", "영업일자", "거래일자"]
        id_keywords = ["승인번호", "카드번호"]
        for i, row in df.head(10).iterrows():
            row_str = " ".join([str(x) for x in row.values])
            has_date = any(k in row_str for k in date_keywords)
            has_id = any(k in row_str for k in id_keywords)
            if has_date and has_id:
                header_row = i + 1  # +1 because row i in data becomes header
                break
                
        if header_row > 0:
            file_bytes.seek(0)
            df = pd.read_excel(file_bytes, header=header_row)
        
        # Resolve column name aliases
        # Date column: 승인일자 > 영업일자 > 거래일자
        date_col = None
        for c in ["승인일자", "영업일자", "거래일자"]:
            if c in df.columns:
                date_col = c
                break
        
        if date_col is None:
            print(f"Error: No date column found. Columns: {list(df.columns)}")
            return []
        
        # Time column: 승인시간 > 거래시간
        time_col = None
        for c in ["승인시간", "거래시간"]:
            if c in df.columns:
                time_col = c
                break
        
        # Installment column: 할부기간 > 할부
        installment_col = None
        for c in ["할부기간", "할부"]:
            if c in df.columns:
                installment_col = c
                break
        
        # Status column: 승인구분 > 구분
        status_col = None
        for c in ["승인구분", "구분"]:
            if c in df.columns:
                status_col = c
                break
        
        # Card corp column: 카드사명 > 매입카드사 > 매입사명
        corp_col = None
        for c in ["카드사명", "매입카드사", "매입사명"]:
            if c in df.columns:
                corp_col = c
                break

        print(f"DEBUG parse_sales_approval: date_col={date_col}, time_col={time_col}, "
              f"installment_col={installment_col}, status_col={status_col}, corp_col={corp_col}")
        print(f"DEBUG columns: {list(df.columns)}")
        
        results = []
        for _, row in df.iterrows():
            # Validate row — skip if date column is empty
            if pd.isna(row.get(date_col)) or str(row.get(date_col)).strip() == "":
                continue

            # Parse Date
            date_val = row.get(date_col)
            try:
                if isinstance(date_val, datetime):
                    approval_date = date_val.date()
                else:
                    date_str = str(date_val).strip()
                    if "-" in date_str:
                        approval_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
                    else:
                        approval_date = datetime.strptime(date_str[:8], "%Y%m%d").date()
            except:
                continue # Skip invalid dates (totals etc)

            amount_raw = row.get("승인금액", 0)
            try:
                amount = int(float(str(amount_raw).replace(",", "").replace("원", "")))
            except:
                amount = 0

            results.append({
                "approval_date": approval_date,
                "approval_time": str(row.get(time_col, "")).strip() if time_col else "",
                "card_corp": str(row.get(corp_col, "Unknown")).strip() if corp_col else "Unknown",
                "card_number": str(row.get("카드번호", "")).strip(),
                "approval_number": str(row.get("승인번호", "")).strip(),
                "amount": amount,
                "installment": str(row.get(installment_col, "일시불")).strip() if installment_col else "일시불",
                "status": str(row.get(status_col, "승인")).strip() if status_col else "승인",
                "shop_name": str(row.get("가맹점명", "")).strip()
            })
            
        return results
    except Exception as e:
        print(f"Error parsing sales approval: {e}")
        import traceback
        traceback.print_exc()
        return []

def parse_payment_history(file):
    """
    Parses '매입(입금)내역 detail' Excel.
    Returns list of dicts for CardPayment.
    """
    try:
        # Read file bytes into memory once to avoid stream exhaustion
        file_bytes = BytesIO(file.file.read())
        
        df = pd.read_excel(file_bytes)
        
        header_row = 0
        for i, row in df.head(10).iterrows():
            row_str = " ".join([str(x) for x in row.values])
            if "지급일자" in row_str or "입금일자" in row_str:
                header_row = i + 1  # +1 because row i in data becomes header
                break
                
        if header_row > 0:
            file_bytes.seek(0)
            df = pd.read_excel(file_bytes, header=header_row)
        
        results = []
        for _, row in df.iterrows():
            date_col = "지급일자" if "지급일자" in df.columns else "입금일자"
            if pd.isna(row.get(date_col)): continue
            
            date_val = row.get(date_col)
            try:
                if isinstance(date_val, datetime):
                    payment_date = date_val.date()
                else:
                    date_str = str(date_val).strip().replace("-", "")
                    payment_date = datetime.strptime(date_str[:8], "%Y%m%d").date()
            except: continue
            
            # Helper to clean numbers
            def clean_num(key):
                try:
                    return int(float(str(row.get(key, 0)).replace(",", "").replace("원", "")))
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
        import traceback
        traceback.print_exc()
        return []

