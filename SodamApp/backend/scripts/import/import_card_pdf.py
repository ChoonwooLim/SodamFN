import os
import re
import sys
import traceback
from datetime import datetime, date
from typing import List, Optional, Dict
from pypdf import PdfReader
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
from sqlmodel import Session, select
from database import engine
from models import Vendor, DailyExpense, MonthlyProfitLoss

# Directory containing PDF files
PDF_DIR = r"C:\WORK\SodamFN\2025실소득분석\카드이용내역서"

def normalize_vendor_name(name: str) -> str:
    """Normalize vendor name for matching."""
    name = re.sub(r'^\(주\)', '', name)
    name = re.sub(r'\(주\)$', '', name)
    name = name.strip()
    return name

def get_or_create_vendor(session: Session, vendor_name: str) -> Vendor:
    """Find existing vendor or create a new one."""
    clean_name = normalize_vendor_name(vendor_name)
    
    # Try exact match first
    statement = select(Vendor).where(Vendor.name == clean_name)
    vendor = session.exec(statement).first()
    
    if not vendor:
        # Create new vendor
        print(f"[NEW VENDOR] Creating: {clean_name}")
        vendor = Vendor(
            name=clean_name,
            category="미분류",  # Default category
            vendor_type="expense"
        )
        session.add(vendor)
        session.commit()
        session.refresh(vendor)
        
    return vendor

def parse_kb_card(text: str) -> List[Dict]:
    """Parse text from KB Card PDF."""
    transactions = []
    lines = text.split('\n')
    date_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}$')
    
    current_date = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
            
        if date_pattern.match(line):
            current_date = line
            continue
            
        if current_date:
            # KB Pattern: Time CardName StoreName Amount PaymentType ...
            # e.g. 16:21 V442 쿠팡이츠 28,701 일시불 ...
            if re.match(r'^\d{2}:\d{2}', line):
                parts = line.split()
                if len(parts) >= 4:
                    try:
                        # Find amount: look for token followed by '일시불' or '할부'
                        amount_idx = -1
                        for idx, part in enumerate(parts):
                            if part in ['일시불', '할부', '승인']: # Keywords often after amount
                                amount_idx = idx - 1
                                break
                        
                        if amount_idx == -1:
                            # Fallback: find the first token with commas that is a valid number (>100 maybe?)
                            # or just the token at index 3?
                            # In sample: 16:21(0) V442(1) 쿠팡이츠(2) 28,701(3) 일시불(4)
                            # But StoreName might have spaces.
                            # So we search from right for "일시불"/"할부"
                            pass
                        
                        if amount_idx != -1:
                            amount_str = parts[amount_idx].replace(',', '')
                            if amount_str.replace('-','').isdigit():
                                amount = int(amount_str)
                                store_name = " ".join(parts[2:amount_idx])
                                
                                transactions.append({
                                    'date': current_date,
                                    'store': store_name,
                                    'amount': amount
                                })
                    except Exception as e:
                        print(f"  KbParser Warning: {e} for line '{line}'")

    return transactions

def parse_samsung_card(text: str) -> List[Dict]:
    """Parse text from Samsung Card PDF."""
    transactions = []
    lines = text.split('\n')
    # Pattern: 25.12.01 15:20:55 ...
    # Next line: VendorName Amount원
    
    date_pattern = re.compile(r'^(\d{2})\.(\d{2})\.(\d{2}) \d{2}:\d{2}:\d{2}')
    
    for i, line in enumerate(lines):
        line = line.strip()
        match = date_pattern.match(line)
        if match:
            # Found date line
            yy, mm, dd = match.groups()
            current_date = f"20{yy}-{mm}-{dd}"
            
            # Look at next line for Vendor and Amount
            if i + 1 < len(lines):
                next_line = lines[i+1].strip()
                # Pattern: VendorName Amount원
                # e.g. "나은온누리약국 68,100원"
                # Split by space, last part is amount
                parts = next_line.split()
                if len(parts) >= 2:
                    amount_part = parts[-1]
                    if amount_part.endswith('원'):
                        try:
                            amount_str = amount_part[:-1].replace(',', '')
                            amount = int(amount_str)
                            store_name = " ".join(parts[:-1])
                            
                            transactions.append({
                                'date': current_date,
                                'store': store_name,
                                'amount': amount
                            })
                        except ValueError:
                            pass
    return transactions

def parse_nh_card(text: str) -> List[Dict]:
    """Parse text from NH Card PDF."""
    transactions = []
    lines = text.split('\n')
    
    # Pattern: M109 2025/03/30
    # Next line: 15:21:55 ... Supply Tax Service Total Merchant Method
    # e.g. ... 69,090 6,910 0 76,000 소금산막국수 일시불
    
    for i, line in enumerate(lines):
        line = line.strip()
        # Look for date line likely starting with card brand code or just containing date
        # Sample: "M109 2025/03/30"
        if re.search(r'\d{4}/\d{2}/\d{2}$', line):
            parts = line.split()
            date_str = parts[-1] # 2025/03/30
            current_date = date_str.replace('/', '-')
            
            # Next line has amount and vendor
            if i + 1 < len(lines):
                next_line = lines[i+1].strip()
                # Split by space
                # 15:21:55 [ApprNo] [Supply] [Tax] [Service] [Total] [Merchant] [Method]
                # We want Total and Merchant.
                # Method is usually last (일시불, etc.)
                # Merchant is before Method.
                # Total is before that?
                # Sample: ... 0 76,000 소금산막국수 일시불
                
                nl_parts = next_line.split()
                if len(nl_parts) >= 6:
                    try:
                        # Scan from end
                        # Last: Method
                        # Second Last: Merchant? (Might be multi-word)
                        # We need to find Total.
                        # Total is usually the largest number before merchant?
                        # Let's count from back.
                        # -1: Method
                        # -2...-k: Merchant
                        # -k-1: Total Amount (digits and comma)
                        
                        method = nl_parts[-1]
                        # Find the index of the last numeric value (Total Amount)
                        # Iterate backwards from -2
                        
                        amount_idx = -1
                        for idx in range(len(nl_parts)-2, 1, -1):
                            s = nl_parts[idx].replace(',', '')
                            if s.isdigit():
                                amount_idx = idx
                                break
                        
                        if amount_idx != -1:
                            amount = int(nl_parts[amount_idx].replace(',', ''))
                            store_name = " ".join(nl_parts[amount_idx+1:-1])
                            
                            transactions.append({
                                'date': current_date,
                                'store': store_name,
                                'amount': amount
                            })
                    except Exception as e:
                        # print(f"NH parse warning: {e}")
                        pass
    return transactions

def parse_woori_card(text: str) -> List[Dict]:
    """Parse text from Woori Card PDF."""
    transactions = []
    lines = text.split('\n')
    
    # Header date range pattern: (2025.01.01 ~ 2025.03.31)
    year = 2025 # Default
    
    for line in lines:
        match = re.search(r'\((\d{4})\.\d{2}\.\d{2} ~', line)
        if match:
            year = int(match.group(1))
            break
            
    # Pattern: 
    # 03.18
    # 10:07:38 [ApprNo] [Card] [Merchant] [BizNo] [Type] [Inst] [Amount] ...
    # e.g. 10:07:38 41173071 9523 （주）롯데렌탈／오토 2148779183 일시불 790,000 0 접수
    
    current_date_md = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        # Date MM.DD
        if re.match(r'^\d{2}\.\d{2}$', line):
            current_date_md = line
            continue
            
        if current_date_md:
            if re.match(r'^\d{2}:\d{2}:\d{2}', line):
                parts = line.split()
                # 0:Time, 1:ApprNo, 2:Card?, 3..N-4: Merchant, N-3: BizNo, N-2: Type??
                # Let's count from back
                # -1: Status/Date? (접수, 2025.03.02)
                # -2: CancelAmount?
                # -3: Amount
                # -4: Installment? (6, 일시불?)
                # -5: Type (일시불, 할부?)
                # -6: BizNum
                # Merchant is before BizNum.
                
                # Sample 1: ... （주）롯데렌탈／오토 2148779183 일시불 790,000 0 접수
                # Parts: [Time, ApprNo, Card, Merchant..., BizNo, Type, Amount, Cancel, Status]
                # Type might be "일시불" or "할부" followed by month "6"
                
                # Logic: Find BizNo (10 digit?) or just Type '일시불'/'할부'
                # BizNo usually starts with digits.
                
                try:
                    # Find '일시불'/'할부'
                    type_idx = -1
                    for idx, p in enumerate(parts):
                        if p in ['일시불', '할부']:
                            type_idx = idx
                            break
                    
                    if type_idx != -1:
                        # BizNo is usually at type_idx - 1
                        # Merchant is parts[3 : type_idx-1]
                        
                        # Amount is at type_idx + 1 (if 일시불) or type_idx + 2 (if 할부 X)
                        # Sample: 할부 6 1,056,111
                        # Sample: 일시불 790,000
                        
                        amount_idx = -1
                        if parts[type_idx] == '할부':
                            amount_idx = type_idx + 2
                        else:
                            amount_idx = type_idx + 1
                            
                        if amount_idx < len(parts):
                            amount_str = parts[amount_idx].replace(',', '')
                            if amount_str.isdigit():
                                amount = int(amount_str)
                                store_name = " ".join(parts[3:type_idx-1]) # 3 is assumed start after CardCode
                                
                                date_str = f"{year}-{current_date_md.replace('.', '-')}"
                                
                                transactions.append({
                                    'date': date_str,
                                    'store': store_name,
                                    'amount': amount
                                })
                except Exception as e:
                    pass
    return transactions

def parse_hana_card(text: str) -> List[Dict]:
    """Parse text from Hana Card PDF."""
    transactions = []
    lines = text.split('\n')
    
    # Pattern:
    # VendorName Amount원
    # YYYY.MM.DD HH:MM:SS ...
    
    # Store previous line info
    prev_line = ""
    
    date_pattern = re.compile(r'^(\d{4})\.(\d{2})\.(\d{2}) \d{2}:\d{2}:\d{2}')
    
    for i, line in enumerate(lines):
        line = line.strip()
        match = date_pattern.match(line)
        if match:
             # Found date line. The PREVIOUS line should be Vendor + Amount
             if prev_line:
                 # Parse prev_line: "VendorName Amount원"
                 # VendorName can have spaces. Amount ends with 원.
                 try:
                     parts = prev_line.split()
                     if parts and parts[-1].endswith('원'):
                         amount_str = parts[-1][:-1].replace(',', '')
                         amount = int(amount_str)
                         store_name = " ".join(parts[:-1])
                         
                         yy, mm, dd = match.groups()
                         date_str = f"{yy}-{mm}-{dd}"
                         
                         transactions.append({
                             'date': date_str,
                             'store': store_name,
                             'amount': amount
                         })
                 except:
                     pass
        
        prev_line = line
    return transactions

def parse_lotte_card(text: str) -> List[Dict]:
    """Parse text from Lotte Card PDF (pdfplumber)."""
    transactions = []
    lines = text.split('\n')
    
    # Pattern: 2025.12.28 ... 가맹점명 ... 금액원 ... 일시불 ...
    # Sample: 2025.12.28 ... (사)한국자동차협회... 10,683원 23447846 일시불 ...
    
    for line in lines:
        line = line.strip()
        # Look for date at start: YYYY.MM.DD or YYYY.M.D
        match = re.match(r'^(\d{4})\.(\d{1,2})\.(\d{1,2})\s', line)
        if match:
            yy, mm, dd = match.groups()
            current_date = f"{yy}-{mm.zfill(2)}-{dd.zfill(2)}"
            
            # Find amount (ends with 원)
            amount_match = re.search(r'([\d,]+)원', line)
            if amount_match:
                try:
                    amount = int(amount_match.group(1).replace(',', ''))
                    
                    # Extract merchant name: After the card name, before amount
                    # Pattern varies, let's try extracting from after the date
                    # Sample: 2025.12.28 (사)한국자동차협회... 롯데... 10,683원
                    # We'll take text between date and amount
                    after_date = line[match.end():]
                    before_amount = after_date.split(amount_match.group(0))[0]
                    
                    # Try to find merchant: often after card name (ends with 카드(...))
                    store_match = re.search(r'카드\([^)]+\)\s+(.+?)\s+[\d,]+원', line)
                    if store_match:
                        store_name = store_match.group(1).strip()
                    else:
                        # Fallback: first non-empty segment after date
                        parts = before_amount.split()
                        store_name = parts[0] if parts else 'Unknown'
                    
                    if store_name and amount > 0:
                        transactions.append({
                            'date': current_date,
                            'store': store_name,
                            'amount': amount
                        })
                except:
                    pass
    return transactions

def parse_shinhan_card(text: str) -> List[Dict]:
    """Parse text from Shinhan Card PDF (pdfplumber)."""
    transactions = []
    lines = text.split('\n')
    
    # Pattern: 2025.09.29 06:31 가맹점명 금액원
    # Sample: 2025.09.2906:31 주식회사유창 195,300원
    
    date_pattern = re.compile(r'^(\d{4})\.(\d{2})\.(\d{2})(\d{2}:\d{2})?\s+(.+?)\s+([\-\d,]+)원$')
    
    for line in lines:
        line = line.strip()
        match = date_pattern.match(line)
        if match:
            try:
                yy, mm, dd, time_part, store_name, amount_str = match.groups()
                current_date = f"{yy}-{mm}-{dd}"
                amount = int(amount_str.replace(',', '').replace('-', ''))
                
                if store_name and amount > 0:
                    transactions.append({
                        'date': current_date,
                        'store': store_name.strip(),
                        'amount': amount
                    })
            except:
                pass
    return transactions

def parse_hyundai_card(text: str) -> List[Dict]:
    """Parse text from Hyundai Card PDF (pdfplumber)."""
    transactions = []
    lines = text.split('\n')
    
    # Pattern: Merchant Amount원
    # Next line: CardName YY.M.DD Type ...
    # Sample: 코스트코코리아 240,340원
    #         대한항공카드 the First 25. 6. 19 일시불 ...
    
    prev_line = ""
    date_pattern = re.compile(r'(\d{2})\. ?(\d{1,2})\. ?(\d{1,2})\s+일시불')
    
    for line in lines:
        line = line.strip()
        match = date_pattern.search(line)
        if match:
            # Previous line is Merchant + Amount
            if prev_line:
                # Parse: "코스트코코리아 240,340원" or "-5,590원" (refund)
                amount_match = re.search(r'([\-\d,]+)원$', prev_line)
                if amount_match:
                    try:
                        amount_str = amount_match.group(1).replace(',', '')
                        amount = abs(int(amount_str))
                        store_name = prev_line[:amount_match.start()].strip()
                        
                        yy, mm, dd = match.groups()
                        current_date = f"20{yy}-{mm.zfill(2)}-{dd.zfill(2)}"
                        
                        if store_name and amount > 0:
                            transactions.append({
                                'date': current_date,
                                'store': store_name,
                                'amount': amount
                            })
                    except:
                        pass
        prev_line = line
    return transactions

def parse_bc_card(text: str) -> List[Dict]:
    """Parse text from BC Card PDF (pdfplumber)."""
    transactions = []
    lines = text.split('\n')
    
    # BC card has complex table format.
    # Pattern: ... YYYY-MM-DD HH:MM:SS ... 가맹점명 ... 금액 ...
    # Sample: 2025-12-22 22:06:58 ... GS25 강동더리버점 ... 9,600 ...
    
    for line in lines:
        line = line.strip()
        # Look for date-time
        date_match = re.search(r'(\d{4})-(\d{2})-(\d{2})\s+\d{2}:\d{2}:\d{2}', line)
        if date_match:
            try:
                yy, mm, dd = date_match.groups()
                current_date = f"{yy}-{mm}-{dd}"
                
                # Find amount: look for standalone number (with commas)
                # Amounts in BC format are usually after merchant name
                amounts = re.findall(r'([\d,]+)(?=\s|$)', line)
                if amounts:
                    # Take first reasonable amount (> 100)
                    for amt_str in amounts:
                        amt = int(amt_str.replace(',', ''))
                        if amt > 100:
                            # Try to extract merchant from before amount
                            # Crude heuristic: split by amount, take left part
                            idx = line.find(amt_str)
                            if idx > 0:
                                left_part = line[:idx].strip()
                                # Merchant is often last word(s) before amount
                                words = left_part.split()
                                if words:
                                    store_name = words[-1]  # Last word
                                    
                                    transactions.append({
                                        'date': current_date,
                                        'store': store_name,
                                        'amount': amt
                                    })
                                    break
            except:
                pass
    return transactions

def process_files():
    """Process all PDF files in the directory."""
    if not os.path.exists(PDF_DIR):
        print(f"Directory not found: {PDF_DIR}")
        return

    files = [f for f in os.listdir(PDF_DIR) if f.lower().endswith('.pdf')]
    print(f"Found {len(files)} PDF files.")

    total_transactions = 0
    
    with Session(engine) as session:
        for filename in files:
            path = os.path.join(PDF_DIR, filename)
            print(f"\nProcessing {filename}...")
            
            try:
                transactions = []
                full_text = ""
                
                # For known problematic cards, use pdfplumber directly
                if "롯데" in filename or "신한" in filename or "현대" in filename or "BC" in filename:
                    if HAS_PDFPLUMBER:
                        try:
                            pdf = pdfplumber.open(path)
                            for page in pdf.pages:
                                page_text = page.extract_text()
                                if page_text:
                                    full_text += page_text + "\n"
                            pdf.close()
                            
                            if "롯데" in filename:
                                transactions = parse_lotte_card(full_text)
                            elif "신한" in filename:
                                transactions = parse_shinhan_card(full_text)
                            elif "현대" in filename:
                                transactions = parse_hyundai_card(full_text)
                            elif "BC" in filename:
                                transactions = parse_bc_card(full_text)
                        except Exception as e:
                            print(f"  pdfplumber error: {e}")
                            traceback.print_exc()
                    else:
                        print(f"  Skipping {filename} (pdfplumber not installed)")
                        continue
                else:
                    # For other cards, use pypdf
                    reader = PdfReader(path)
                    try:
                        for i, page in enumerate(reader.pages):
                            full_text += page.extract_text() + "\n"
                    except Exception:
                        try:
                            print("  Retrying with layout mode...")
                            full_text = ""
                            for i, page in enumerate(reader.pages):
                                full_text += page.extract_text(extraction_mode="layout") + "\n"
                        except Exception as e2:
                            print(f"  Error extracting text from {filename}: {e2}")
                            continue
                    
                    if "국민" in filename:
                        transactions = parse_kb_card(full_text)
                    elif "삼성" in filename:
                        transactions = parse_samsung_card(full_text)
                    elif "농협" in filename:
                        transactions = parse_nh_card(full_text)
                    elif "우리" in filename:
                        transactions = parse_woori_card(full_text)
                    elif "하나" in filename:
                        transactions = parse_hana_card(full_text)
                    else:
                        print(f"  Skipping parsing for {filename} (Not supported yet)")
                        continue
                
                print(f"  Found {len(transactions)} transactions.")
                total_transactions += len(transactions)
                
                for t in transactions:
                    date_str = t['date']
                    store_name = t['store']
                    amount = t['amount']
                    
                    dt = datetime.strptime(date_str, "%Y-%m-%d").date()
                    
                    try:
                        # 1. Get/Create Vendor
                        vendor = get_or_create_vendor(session, store_name)
                        
                        # 2. Check for duplicate expense
                        existing = session.exec(
                            select(DailyExpense)
                            .where(DailyExpense.date == dt)
                            .where(DailyExpense.vendor_id == vendor.id)
                            .where(DailyExpense.amount == amount)
                        ).first()
                        
                        if existing:
                            continue
                            
                        # 3. Create Expense
                        expense = DailyExpense(
                            date=dt,
                            vendor_name=vendor.name,
                            vendor_id=vendor.id,
                            amount=amount,
                            category=vendor.category,
                            note=f"{filename} 자동입력"
                        )
                        session.add(expense)
                    except Exception as e:
                        print(f"  Error saving transaction {date_str} {store_name}: {e}")
                        traceback.print_exc()

            except Exception as e:
                print(f"Error processing {filename}: {e}")
                traceback.print_exc()
        
        session.commit()
    
    print(f"\nTotal transactions processed: {total_transactions}")

def update_profit_loss():
    """Update MonthlyProfitLoss with new expenses."""
    print("\nupdating Profit/Loss statements...")
    with Session(engine) as session:
        # Get all expenses for 2025
        expenses = session.exec(
            select(DailyExpense)
            .where(DailyExpense.date >= date(2025, 1, 1))
            .where(DailyExpense.date <= date(2025, 12, 31))
        ).all()
        
        # Aggregate
        monthly_map = {} 
        
        for e in expenses:
            month = e.date.month
            if month not in monthly_map:
                monthly_map[month] = {
                    'expense_material': 0, 
                    'expense_rent': 0, 
                    'expense_utility': 0, 
                    'expense_labor': 0, 
                    'expense_card_fee': 0, 
                    'expense_personal': 0,
                }
            
            cat = e.category
            amt = e.amount
            
            if cat in ['재료비', '식자재']:
                monthly_map[month]['expense_material'] += amt
            elif cat in ['임대료', '관리비', '월세']:
                monthly_map[month]['expense_rent'] += amt
            elif cat in ['공과금', '전기세', '수도세', '가스비']:
                monthly_map[month]['expense_utility'] += amt
            elif cat in ['인건비', '급여']:
                monthly_map[month]['expense_labor'] += amt
            elif cat == '카드수수료':
                monthly_map[month]['expense_card_fee'] += amt
            elif cat in ['개인생활비', '생활비', '개인']:
                monthly_map[month]['expense_personal'] += amt
            
        for month, data in monthly_map.items():
            pl = session.exec(
                select(MonthlyProfitLoss)
                .where(MonthlyProfitLoss.year == 2025)
                .where(MonthlyProfitLoss.month == month)
            ).first()
            
            if not pl:
                pl = MonthlyProfitLoss(year=2025, month=month)
                session.add(pl)
            
            # Smart update: Only update if the aggregated value is non-zero
            # This preserves manually entered data if my aggregation misses it
            if data['expense_material'] > 0: pl.expense_material = data['expense_material']
            if data['expense_rent'] > 0: pl.expense_rent = data['expense_rent']
            if data['expense_utility'] > 0: pl.expense_utility = data['expense_utility']
            if data['expense_labor'] > 0: pl.expense_labor = data['expense_labor']
            if data['expense_card_fee'] > 0: pl.expense_card_fee = data['expense_card_fee']
            if data['expense_personal'] > 0: pl.expense_personal = data['expense_personal']
            
            session.add(pl)
        
        session.commit()
    print("Profit/Loss update complete.")

if __name__ == "__main__":
    process_files()
    update_profit_loss()
