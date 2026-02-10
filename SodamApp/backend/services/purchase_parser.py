"""
Purchase (매입) Excel Parser Service
Supports: 롯데카드, 삼성카드, 신한카드, 신한은행 송금, 현대카드
Auto-detects card company and format (HTML-as-xls vs real Excel).
"""
import os
import re
import pandas as pd
from datetime import date, datetime
from typing import List, Dict, Optional

# ─── Category classification rules ───
CATEGORY_RULES = {
    "개인생활비": [
        "병원", "의원", "치과", "약국", "의료", "안과", "한의원",
        "이비인후과", "신경과", "호텔", "숙박", "여행",
        "주렁주렁", "놀이", "레저",
        "식당", "요식", "음식점", "카페", "커피", "베이커리", "빵", "제과",
        "스타벅스", "투썸", "맥도날드", "버거", "피자", "치킨", "분식", "김가네",
    ],
    "재료비": [
        "한식", "식품", "농가공산품", "할인점", "슈퍼마켓", "마트", "푸드",
        "식자재", "농산물", "수산물", "축산물", "반찬", "김밥", "쿠팡",
        "다인푸드", "트레이더스", "이마트", "코스트코",
    ],
    "재료비_포장": [
        "봉투", "팩", "포장", "쇼핑/유통", "가락팩", "가락봉투",
        "신진상사", "라디스펜사",
    ],
    "제세공과금": [
        "가스", "전기", "수도", "도시가스", "한전", "가정용연료", "예스코",
        "국세", "지방세", "세금",
    ],
    "임대관리비": [
        "관리비", "관리단", "임대",
    ],
    "카드수수료": [
        "카드수수료", "카드사",
    ],
    "기타비용": [],  # Fallback
}


def classify_category(vendor_name: str, business_type: str = "") -> str:
    """Classify a purchase into an expense category based on vendor name and business type."""
    combined = f"{vendor_name} {business_type}".lower()
    for category, keywords in CATEGORY_RULES.items():
        for kw in keywords:
            if kw.lower() in combined:
                return category.replace("_포장", "")  # 재료비_포장 → 재료비
    return "기타비용"


def _is_html_file(filepath: str) -> bool:
    """Check if an .xls file is actually HTML (common for Korean bank exports)."""
    with open(filepath, 'rb') as f:
        header = f.read(500)
    return (b'<html' in header.lower() or b'<!doctype' in header.lower()
            or b'<table' in header.lower() or header.startswith(b'\r\n\r\n'))


def _normalize_date(date_str: str) -> Optional[date]:
    """Parse various Korean date formats into a date object."""
    if pd.isna(date_str) or not date_str:
        return None
    s = str(date_str).strip()
    # "2026년 01월 31일" → "2026-01-31"
    m = re.match(r'(\d{4})년?\s*(\d{1,2})월?\s*(\d{1,2})일?', s)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    # "2026.01.31" or "2026-01-31"
    for fmt in ['%Y.%m.%d', '%Y-%m-%d', '%Y/%m/%d']:
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def _clean_amount(val) -> int:
    """Convert various amount formats to integer."""
    if pd.isna(val):
        return 0
    s = str(val).replace(',', '').replace('원', '').replace(' ', '').strip()
    # Remove negative sign for cancelled transactions
    s = s.lstrip('-')
    try:
        return abs(int(float(s)))
    except (ValueError, TypeError):
        return 0


# ═══════════════════════════════════════════════════════════════
# Card Company Parsers
# ═══════════════════════════════════════════════════════════════

def parse_lotte(filepath: str) -> List[Dict]:
    """Parse 롯데카드 이용내역 (HTML-as-xls format)."""
    dfs = pd.read_html(filepath, encoding='utf-8')
    # Table 2 is the main domestic usage table (Table 1 is summary, Table 3 is overseas)
    if len(dfs) < 2:
        return []

    df = dfs[1]  # Main domestic table
    records = []

    for _, row in df.iterrows():
        use_date = _normalize_date(row.get('이용일자'))
        if not use_date:
            continue

        vendor_name = str(row.get('이용가맹점', '')).strip()
        if not vendor_name or vendor_name == 'nan':
            continue

        amount = _clean_amount(row.get('이용금액', 0))
        if amount == 0:
            continue

        is_cancelled = str(row.get('취소여부', 'N')).strip().upper() == 'Y'
        business_type = str(row.get('업종', ''))

        records.append({
            'date': use_date,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': classify_category(vendor_name, business_type),
            'card_company': '롯데카드',
            'approval_no': str(row.get('승인번호', '')),
            'business_type': business_type,
            'is_cancelled': is_cancelled,
        })

    return records


def parse_samsung(filepath: str) -> List[Dict]:
    """Parse 삼성카드 이용내역 (real xlsx format)."""
    xls = pd.ExcelFile(filepath, engine='openpyxl')
    # Sheet '■ 국내이용내역' has the detail data
    sheet_name = None
    for s in xls.sheet_names:
        if '국내이용내역' in s:
            sheet_name = s
            break
    if not sheet_name:
        sheet_name = xls.sheet_names[-1]  # Fallback to last sheet

    df = pd.read_excel(xls, sheet_name=sheet_name, header=None)

    # Find header row (row containing '승인일자' or '가맹점명')
    header_idx = 0
    for i in range(min(5, len(df))):
        row_vals = [str(v) for v in df.iloc[i].values]
        if any('승인일자' in v or '가맹점명' in v for v in row_vals):
            header_idx = i
            break

    df.columns = df.iloc[header_idx].values
    df = df.iloc[header_idx + 1:].reset_index(drop=True)

    records = []
    for _, row in df.iterrows():
        use_date = _normalize_date(row.get('승인일자'))
        if not use_date:
            continue

        vendor_name = str(row.get('가맹점명', '')).strip()
        if not vendor_name or vendor_name == 'nan':
            continue

        amount = _clean_amount(row.get('승인금액(원)', row.get('승인금액', 0)))
        if amount == 0:
            continue

        is_cancelled = str(row.get('취소여부', '-')).strip() not in ['-', 'nan', '', 'N']

        records.append({
            'date': use_date,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': classify_category(vendor_name, ''),
            'card_company': '삼성카드',
            'approval_no': str(row.get('승인번호', '')),
            'business_type': '',
            'is_cancelled': is_cancelled,
        })

    return records


def parse_shinhan_card(filepath: str) -> List[Dict]:
    """Parse 신한카드 이용내역 (real xls format)."""
    df = pd.read_excel(filepath, header=None, engine='xlrd')

    # Find header row
    header_idx = 0
    for i in range(min(5, len(df))):
        row_vals = [str(v) for v in df.iloc[i].values]
        if any('이용일자' in v or '가맹점명' in v for v in row_vals):
            header_idx = i
            break

    df.columns = df.iloc[header_idx].values
    df = df.iloc[header_idx + 1:].reset_index(drop=True)

    records = []
    for _, row in df.iterrows():
        use_date = _normalize_date(row.get('이용일자'))
        if not use_date:
            continue

        vendor_name = str(row.get('가맹점명', '')).strip()
        if not vendor_name or vendor_name == 'nan':
            continue

        amount = _clean_amount(row.get('금액', 0))
        if amount == 0:
            continue

        cancel_status = str(row.get('취소상태', '')).strip()
        is_cancelled = cancel_status not in ['', 'nan', 'NaN']

        business_type = str(row.get('업종', ''))

        records.append({
            'date': use_date,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': classify_category(vendor_name, business_type),
            'card_company': '신한카드',
            'approval_no': str(row.get('승인번호', '')),
            'business_type': business_type,
            'is_cancelled': is_cancelled,
        })

    return records


def parse_shinhan_bank(filepath: str) -> List[Dict]:
    """Parse 신한은행 송금내역 (real xls format)."""
    df = pd.read_excel(filepath, header=None, engine='xlrd')

    # Find header row (contains '거래일자')
    header_idx = 0
    for i in range(min(10, len(df))):
        row_vals = [str(v) for v in df.iloc[i].values]
        if any('거래일자' in v for v in row_vals):
            header_idx = i
            break

    df.columns = df.iloc[header_idx].values
    df = df.iloc[header_idx + 1:].reset_index(drop=True)

    records = []
    for _, row in df.iterrows():
        use_date = _normalize_date(row.get('거래일자'))
        if not use_date:
            continue

        # '출금(원)' is the amount, '내용' is the vendor/description
        amount = _clean_amount(row.get('출금(원)', 0))
        if amount == 0:
            continue

        vendor_name = str(row.get('내용', '')).strip()
        if not vendor_name or vendor_name == 'nan':
            continue

        # Exclude credit card payments to avoid double counting
        # (Since we upload card statements separately)
        if '카드' in vendor_name or '삼성' in vendor_name or '현대' in vendor_name or '롯데' in vendor_name:
             # Check if it looks like a card payment (e.g. "삼성카드", "현대카드", "롯데카드")
             # But be careful not to exclude "삼성전자" or "롯데마트" if they appear in bank text (though usually bank text is just vendor name)
             # Shinhan Bank export usually says "신한카드", "삼성카드(주)", "롯데카드(주)" etc.
             if any(c in vendor_name for c in ['카드', '카드(주)', '카드대금']):
                 continue

        records.append({
            'date': use_date,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': classify_category(vendor_name, ''),
            'card_company': '신한은행',
            'approval_no': '',
            'business_type': '은행이체',
            'is_cancelled': False,
        })

    return records


def parse_hyundai(filepath: str) -> List[Dict]:
    """Parse 현대카드 이용내역 (HTML-as-xls format)."""
    dfs = pd.read_html(filepath, encoding='utf-8')
    if len(dfs) < 1:
        return []

    df = dfs[0]

    # Find header row (contains '이용일자' or '가맹점명')
    header_idx = None
    for i in range(min(5, len(df))):
        row_vals = [str(v) for v in df.iloc[i].values]
        if any('이용일자' in v for v in row_vals):
            header_idx = i
            break

    if header_idx is not None:
        df.columns = df.iloc[header_idx].values
        df = df.iloc[header_idx + 1:].reset_index(drop=True)

    records = []
    for _, row in df.iterrows():
        use_date = _normalize_date(row.get('이용일자'))
        if not use_date:
            continue

        vendor_name = str(row.get('가맹점명', '')).strip()
        if not vendor_name or vendor_name == 'nan':
            continue

        amount = _clean_amount(row.get('이용금액', 0))
        if amount == 0:
            continue

        business_type = str(row.get('분야', ''))

        # Hyundai: summary rows at bottom start with '-'
        if vendor_name.startswith('-') or '소계' in vendor_name or '합계' in vendor_name:
            continue

        records.append({
            'date': use_date,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': classify_category(vendor_name, business_type),
            'card_company': '현대카드',
            'approval_no': str(row.get('승인번호', '')),
            'business_type': business_type,
            'is_cancelled': False,
        })

    return records


# ═══════════════════════════════════════════════════════════════
# Main Entry Point
# ═══════════════════════════════════════════════════════════════

def detect_card_company(filepath: str, filename: str) -> str:
    """Auto-detect card company from filename."""
    fn = filename.lower()
    if '롯데' in fn or 'lotte' in fn:
        return 'lotte'
    elif '삼성' in fn or 'samsung' in fn:
        return 'samsung'
    elif '신한은행' in fn or '송금' in fn:
        return 'shinhan_bank'
    elif '신한카드' in fn or '신한' in fn:
        return 'shinhan_card'
    elif '현대' in fn or 'hyundai' in fn:
        return 'hyundai'
    return 'unknown'


def parse_purchase_file(filepath: str, filename: str = None) -> List[Dict]:
    """
    Parse a purchase Excel file and return standardized records.
    Auto-detects card company and file format.

    Returns list of dicts:
        [{date, vendor_name, amount, category, card_company, approval_no, business_type, is_cancelled}]
    """
    if filename is None:
        filename = os.path.basename(filepath)

    company = detect_card_company(filepath, filename)

    parsers = {
        'lotte': parse_lotte,
        'samsung': parse_samsung,
        'shinhan_card': parse_shinhan_card,
        'shinhan_bank': parse_shinhan_bank,
        'hyundai': parse_hyundai,
    }

    parser = parsers.get(company)
    if not parser:
        raise ValueError(f"지원하지 않는 카드사/은행 파일입니다: {filename}")

    records = parser(filepath)

    # Filter out cancelled transactions
    active_records = [r for r in records if not r.get('is_cancelled', False)]

    return active_records
