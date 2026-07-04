"""
Purchase (매입) Excel/PDF Parser Service
Supports: 롯데카드, 삼성카드, 신한카드, 신한은행 송금(XLS/PDF), 현대카드
Auto-detects card company and format (HTML-as-xls vs real Excel vs PDF).
"""
import os
import re
import pandas as pd
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional

# ─── Category classification rules (2026 재편) ───
# 주의: dict 순서가 우선순위! 세금과공과가 원재료비보다 먼저 와야
# "국세_소담김밥"이 "국세"로 매칭됨 (김밥보다 먼저)
CATEGORY_RULES = {
    "개인가계부": [
        "병원", "의원", "치과", "약국", "의료", "안과", "한의원",
        "이비인후과", "신경과", "호텔", "숙박", "여행",
        "주렁주렁", "놀이", "레저",
        "식당", "요식", "음식점", "카페", "커피", "베이커리", "빵", "제과",
        "스타벅스", "투썸", "맥도날드", "버거", "피자", "치킨", "분식", "김가네",
    ],
    "세금과공과": [
        "국세", "지방세", "세금", "부가세", "종합소득세", "부가가치세",
    ],
    "원재료비": [
        "한식", "식품", "농가공산품", "할인점", "슈퍼마켓", "마트", "푸드",
        "식자재", "농산물", "수산물", "축산물", "반찬", "김밥", "쿠팡",
        "다인푸드", "트레이더스", "이마트", "코스트코",
    ],
    "소모품비": [
        "봉투", "팩", "포장", "가락팩", "가락봉투",
        "신진상사", "라디스펜사",
    ],
    "수도광열비": [
        "가스", "전기", "수도", "도시가스", "한전", "가정용연료", "예스코",
    ],
    "임차료": [
        "관리비", "관리단", "임대", "스타시티",
    ],
    # 4대보험 공단 납부 — 인건비 섹션(4대보험료)에 이미 반영되므로 P/L·비용집계에서 제외
    # (인건비보다 먼저 와야 "국민연금" 등이 4대보험납부로 매칭됨)
    "4대보험납부": [
        "산재보험", "고용보험", "국민연금", "건강보험", "국민건강", "4대보험",
    ],
    "인건비": [
        "급여", "상여", "퇴직금",
    ],
    "카드수수료": [
        "카드수수료", "카드사",
    ],
    "기타경비": [],  # Fallback
}


def classify_category(vendor_name: str, business_type: str = "") -> str:
    """Classify a purchase into an expense category based on vendor name and business type."""
    combined = f"{vendor_name} {business_type}".lower()
    for category, keywords in CATEGORY_RULES.items():
        for kw in keywords:
            if kw.lower() in combined:
                return category
    return "기타경비"


def _is_html_file(filepath: str) -> bool:
    """Check if an .xls file is actually HTML (common for Korean bank exports)."""
    with open(filepath, 'rb') as f:
        header = f.read(500)
    return (b'<html' in header.lower() or b'<!doctype' in header.lower()
            or b'<table' in header.lower() or header.startswith(b'\r\n\r\n'))


def _read_excel_auto(filepath: str, header=None) -> pd.DataFrame:
    """엑셀 포맷(xls/xlsx)을 매직바이트로 판별해 알맞은 엔진으로 읽기.

    카드사/은행 사이트가 같은 다운로드 메뉴에서 시기에 따라 .xls(구형 OLE2)와
    .xlsx(zip)를 섞어 내보내고 확장자도 신뢰할 수 없어서(xlsx 내용의 .xls 등)
    파일 내용으로 판별한다. engine 고정 시 반대 포맷에서 XLRDError 발생.
    """
    with open(filepath, 'rb') as f:
        head = f.read(8)
    if head[:4] == b'PK\x03\x04':                            # xlsx (zip)
        return pd.read_excel(filepath, header=header, engine='openpyxl')
    if head == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1':          # xls (OLE2)
        return pd.read_excel(filepath, header=header, engine='xlrd')
    return pd.read_excel(filepath, header=header)             # pandas 추론


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
    """Parse 신한카드 이용내역.

    두 가지 export 포맷 지원:
      - 구형 .xls: 이용일자 / 가맹점명 / 금액 / 취소상태 / 업종 / 승인번호
      - 신형 .xlsx(2026-07~): 거래일 / 가맹점명 / 금액 / 매입구분(취소 표기) / 업종 / 승인번호
    """
    df = _read_excel_auto(filepath, header=None)

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
        use_date = _normalize_date(row.get('이용일자') if row.get('이용일자') is not None
                                   else row.get('거래일'))
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
        if not is_cancelled:
            # 신형 xlsx: 매입구분/이용구분에 '취소' 표기 (예: 취소매입, 승인취소)
            status_text = f"{row.get('매입구분', '')}{row.get('이용구분', '')}"
            is_cancelled = '취소' in status_text

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


def parse_shinhan_bank_pdf(filepath: str) -> List[Dict]:
    """Parse 신한은행 거래내역 PDF (pdfplumber).

    Same filtering logic as XLS parser: excludes card payments & staff salary.
    """
    import pdfplumber

    # ── 카드대금 제외 키워드 ──
    CARD_PAYMENT_KEYWORDS = [
        '삼성카드', '현대카드', '롯데카드', '신한카드', '비씨카드',
        '하나카드', '국민카드', 'KB카드', '우리카드', '카드대금',
    ]

    # ── 직원 이름 ──
    staff_names = set()
    try:
        from database import engine as db_engine
        from sqlmodel import Session as DBSession, text
        with DBSession(db_engine) as session:
            result = session.exec(text("SELECT name FROM staff"))
            staff_names = {r[0].strip() for r in result if r[0]}
    except Exception:
        pass
    FOREIGN_STAFF = {'PHAM THI THUY LINH', 'DAO KIM HONG NGOC', 'JINJINSHUN'}
    staff_names.update(FOREIGN_STAFF)

    VENDOR_ALIASES = {
        '최희상': '홍성상회',
        '김영민': '찬들농산',
        '유용운': '창미포장',
    }

    records = []
    excluded_cards = 0
    excluded_salary = 0

    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or len(row) < 6:
                        continue
                    # row: [날짜, 시간, 적요, 출금, 입금, 내용, 잔액, 거래점]
                    date_val = str(row[0] or '').strip()
                    use_date = _normalize_date(date_val)
                    if not use_date:
                        continue

                    amount = _clean_amount(row[3])  # 출금
                    if amount == 0:
                        continue

                    vendor_name = str(row[5] or '').strip() if len(row) > 5 else ''
                    if not vendor_name or vendor_name == 'None':
                        vendor_name = str(row[2] or '').strip()  # fallback to 적요
                    if not vendor_name:
                        continue

                    # ① 카드대금 제외
                    if any(kw in vendor_name for kw in CARD_PAYMENT_KEYWORDS):
                        excluded_cards += 1
                        continue

                    # ② 직원 급여 제외
                    if vendor_name in staff_names:
                        excluded_salary += 1
                        continue

                    # ③ 개인 이름 → 상호명
                    if vendor_name in VENDOR_ALIASES:
                        vendor_name = VENDOR_ALIASES[vendor_name]

                    category = classify_category(vendor_name, '')

                    # ④ 임차료 월초 날짜 조정 (월초 1~7일 → 전월 말일, 긴 연휴 대응)
                    if category == '임차료' and use_date:
                        if isinstance(use_date, str):
                            d = datetime.strptime(use_date, '%Y-%m-%d').date()
                        else:
                            d = use_date
                        if d.day <= 7:
                            first_of_month = d.replace(day=1)
                            last_of_prev = first_of_month - timedelta(days=1)
                            use_date = str(last_of_prev)

                    records.append({
                        'date': use_date,
                        'vendor_name': vendor_name,
                        'amount': amount,
                        'category': category,
                        'card_company': '신한은행',
                        'approval_no': '',
                        'business_type': '은행이체',
                        'is_cancelled': False,
                    })

    if excluded_cards or excluded_salary:
        print(f"  [신한은행PDF] 카드대금 {excluded_cards}건, 직원급여 {excluded_salary}건 제외")

    return records


def parse_shinhan_bank(filepath: str) -> List[Dict]:
    """Parse 신한은행 송금내역 (real xls format).
    
    Excludes:
    - 카드대금 결제 (삼성카드, 현대카드, 롯데카드 등 — 카드 명세서로 별도 업로드)
    - 직원 급여 이체 (Staff 테이블 기반 동적 감지)
    """
    df = _read_excel_auto(filepath, header=None)

    # Find header row (contains '거래일자')
    header_idx = 0
    for i in range(min(10, len(df))):
        row_vals = [str(v) for v in df.iloc[i].values]
        if any('거래일자' in v for v in row_vals):
            header_idx = i
            break

    df.columns = df.iloc[header_idx].values
    df = df.iloc[header_idx + 1:].reset_index(drop=True)

    # ── 카드대금 제외 키워드 ──
    CARD_PAYMENT_KEYWORDS = [
        '삼성카드', '현대카드', '롯데카드', '신한카드', '비씨카드',
        '하나카드', '국민카드', 'KB카드', '우리카드', '카드대금',
    ]

    # ── 직원 이름 (Staff DB에서 가져옴) ──
    staff_names = set()
    try:
        from database import engine as db_engine
        from sqlmodel import Session as DBSession, text
        with DBSession(db_engine) as session:
            result = session.exec(text("SELECT name FROM staff"))
            staff_names = {r[0].strip() for r in result if r[0]}
    except Exception:
        pass
    # 외국인 직원 (DB name과 은행 표기가 다를 수 있음)
    FOREIGN_STAFF = {
        'PHAM THI THUY LINH', 'DAO KIM HONG NGOC', 'JINJINSHUN',
    }
    staff_names.update(FOREIGN_STAFF)

    # ── 개인 이름 → 상호명 매핑 ──
    VENDOR_ALIASES = {
        '최희상': '홍성상회',
        '김영민': '찬들농산',
        '유용운': '창미포장',
    }

    records = []
    excluded_cards = 0
    excluded_salary = 0

    for _, row in df.iterrows():
        use_date = _normalize_date(row.get('거래일자'))
        if not use_date:
            continue

        # '출금(원)' or '출금' is the amount, '내용' is the vendor/description
        amount = _clean_amount(row.get('출금(원)', row.get('출금', 0)))
        if amount == 0:
            continue

        vendor_name = str(row.get('내용', '')).strip()
        if not vendor_name or vendor_name == 'nan':
            continue

        # ① 카드대금 결제 제외 (카드 명세서로 이미 업로드)
        if any(kw in vendor_name for kw in CARD_PAYMENT_KEYWORDS):
            excluded_cards += 1
            continue

        # ② 직원 급여 이체 제외 (직원관리 모듈에서 관리)
        if vendor_name in staff_names:
            excluded_salary += 1
            continue

        # ③ 개인 이름 → 상호명 변환
        if vendor_name in VENDOR_ALIASES:
            vendor_name = VENDOR_ALIASES[vendor_name]

        category = classify_category(vendor_name, '')

        # ④ 임차료 월초 날짜 조정 (발생주의)
        # 임대료/관리비가 월초(1~7일)에 결제된 경우 → 전월 말일로 이동
        # - 월말이 주말/공휴일이면 다음 영업일로 이체 지연 (설날/추석 최대 5~6일 연휴 대응)
        # - 기존 5일 → 7일로 확장하여 긴 연휴로 인한 누락 방지
        if category == '임차료' and use_date:
            # use_date may be a date object or string
            if isinstance(use_date, str):
                d = datetime.strptime(use_date, '%Y-%m-%d').date()
            else:
                d = use_date
            if d.day <= 7:  # 월초 1~7일
                # 전월 말일로 이동 — 다른 레코드와 동일하게 date 객체 유지
                # (str 로 바꾸면 타입이 섞여 정렬/중복판정이 깨짐)
                first_of_month = d.replace(day=1)
                last_of_prev = first_of_month - timedelta(days=1)
                original_date = str(use_date)
                use_date = last_of_prev
                print(f"  [날짜조정] {vendor_name}: {original_date} → {use_date} (임차료 발생주의)")

        records.append({
            'date': use_date,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': category,
            'card_company': '신한은행',
            'approval_no': '',
            'business_type': '은행이체',
            'is_cancelled': False,
        })

    if excluded_cards or excluded_salary:
        print(f"  [신한은행] 카드대금 {excluded_cards}건, 직원급여 {excluded_salary}건 제외")

    return records


def parse_hyundai(filepath: str) -> List[Dict]:
    """Parse 현대카드 이용내역 (HTML-as-xls format).

    현대카드 웹 다운로드 파일은 HTML 테이블을 .xls 확장자로 저장한 형태이며,
    pandas read_html 사용 시 다단 컬럼 헤더가 생성될 수 있음
    (e.g. ('실시간 이용내역', '이용내역', '이용일')).
    """
    dfs = pd.read_html(filepath, encoding='utf-8')
    if len(dfs) < 1:
        return []

    df = dfs[0]

    # Flatten multi-level columns: take the deepest (most specific) level
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [str(c[-1]) for c in df.columns]
    else:
        df.columns = [str(c) for c in df.columns]

    # Some variants put field names inside the first data rows instead of headers
    # → detect a row that contains both a date-like and amount-like header keyword
    header_idx = None
    for i in range(min(5, len(df))):
        row_vals = [str(v) for v in df.iloc[i].values]
        has_date = any(('이용일' in v) or ('이용일자' in v) for v in row_vals)
        has_amount = any('이용금액' in v for v in row_vals)
        if has_date and has_amount:
            header_idx = i
            break

    if header_idx is not None:
        df.columns = [str(v) for v in df.iloc[header_idx].values]
        df = df.iloc[header_idx + 1:].reset_index(drop=True)

    # Column name resolution (supports both 이용일 / 이용일자 variants)
    def _find_col(candidates):
        for c in candidates:
            if c in df.columns:
                return c
        return None

    date_col = _find_col(['이용일자', '이용일', '승인일', '승인일자', '거래일자', '매출일자'])
    vendor_col = _find_col(['가맹점명', '가맹점', '상호'])
    amount_col = _find_col(['이용금액', '승인금액', '결제금액', '금액'])
    approval_col = _find_col(['승인번호', '거래번호'])
    business_col = _find_col(['이용분야', '분야', '업종', '가맹점업종'])
    cancel_col = _find_col(['취소여부', '취소구분', '취소일'])
    # '승인구분' (전표접수/취소) is a transaction status, not a category
    status_col = _find_col(['승인구분', '거래구분'])

    if not date_col or not vendor_col or not amount_col:
        return []

    records = []
    for _, row in df.iterrows():
        use_date = _normalize_date(row.get(date_col))
        if not use_date:
            continue

        vendor_name = str(row.get(vendor_col, '')).strip()
        if not vendor_name or vendor_name == 'nan':
            continue

        # Hyundai: summary rows at bottom start with '-' or contain 소계/합계
        if vendor_name.startswith('-') or '소계' in vendor_name or '합계' in vendor_name:
            continue

        amount = _clean_amount(row.get(amount_col, 0))
        if amount == 0:
            continue

        business_type = str(row.get(business_col, '')) if business_col else ''
        approval_no = str(row.get(approval_col, '')) if approval_col else ''

        # Cancellation detection: if 취소여부/취소일 column has a value (not '-' / empty)
        # OR if 승인구분 column indicates cancellation (e.g. '취소')
        is_cancelled = False
        if cancel_col:
            cancel_val = str(row.get(cancel_col, '')).strip()
            if cancel_val and cancel_val not in ('-', 'nan', ''):
                is_cancelled = True
        if not is_cancelled and status_col:
            status_val = str(row.get(status_col, '')).strip()
            if '취소' in status_val:
                is_cancelled = True

        records.append({
            'date': use_date,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': classify_category(vendor_name, business_type),
            'card_company': '현대카드',
            'approval_no': approval_no,
            'business_type': business_type,
            'is_cancelled': is_cancelled,
        })

    return records


def _parse_generic_bank(filepath: str, bank_name: str) -> List[Dict]:
    """Generic bank transfer parser (국민은행, 수협은행 등).
    Reuses the same column format as 신한은행: 거래일자, 출금(원), 내용.
    
    Excludes:
    - 카드대금 결제 (삼성카드, 현대카드, 롯데카드 등 — 카드 명세서로 별도 업로드)
    - 직원 급여 이체 (Staff 테이블 기반 동적 감지)
    """
    df = _read_excel_auto(filepath, header=None)

    # Find header row (contains '거래일자')
    header_idx = 0
    for i in range(min(10, len(df))):
        row_vals = [str(v) for v in df.iloc[i].values]
        if any('거래일자' in v for v in row_vals):
            header_idx = i
            break

    df.columns = df.iloc[header_idx].values
    df = df.iloc[header_idx + 1:].reset_index(drop=True)

    # ── 카드대금 제외 키워드 ──
    CARD_PAYMENT_KEYWORDS = [
        '삼성카드', '현대카드', '롯데카드', '신한카드', '비씨카드',
        '하나카드', '국민카드', 'KB카드', '우리카드', '카드대금',
    ]

    # ── 직원 이름 (Staff DB에서 가져옴) ──
    staff_names = set()
    try:
        from database import engine as db_engine
        from sqlmodel import Session as DBSession, text
        with DBSession(db_engine) as session:
            result = session.exec(text("SELECT name FROM staff"))
            staff_names = {r[0].strip() for r in result if r[0]}
    except Exception:
        pass

    # Try to find amount and vendor columns flexibly
    amount_col = None
    vendor_col = None
    for col in df.columns:
        col_str = str(col)
        if '출금' in col_str:
            amount_col = col
        elif col_str in ('내용', '적요', '거래내용', '비고'):
            vendor_col = col

    if amount_col is None:
        # Fallback: try column index patterns
        amount_col = df.columns[2] if len(df.columns) > 2 else None
    if vendor_col is None:
        vendor_col = df.columns[1] if len(df.columns) > 1 else None

    records = []
    excluded_cards = 0
    excluded_salary = 0

    for _, row in df.iterrows():
        use_date = _normalize_date(row.get('거래일자'))
        if not use_date:
            continue

        amount = _clean_amount(row.get(amount_col, 0)) if amount_col else 0
        if amount == 0:
            continue

        vendor_name = str(row.get(vendor_col, '')).strip() if vendor_col else ''
        if not vendor_name or vendor_name == 'nan':
            continue

        # ① 카드대금 결제 제외
        if any(kw in vendor_name for kw in CARD_PAYMENT_KEYWORDS):
            excluded_cards += 1
            continue

        # ② 직원 급여 이체 제외
        if vendor_name in staff_names:
            excluded_salary += 1
            continue

        category = classify_category(vendor_name, '')

        records.append({
            'date': use_date,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': category,
            'card_company': bank_name,
            'approval_no': '',
            'business_type': '은행이체',
            'is_cancelled': False,
        })

    if excluded_cards or excluded_salary:
        print(f"  [{bank_name}] 카드대금 {excluded_cards}건, 직원급여 {excluded_salary}건 제외")

    return records


# ═══════════════════════════════════════════════════════════════
# Main Entry Point
# ═══════════════════════════════════════════════════════════════

def detect_card_company(filepath: str, filename: str) -> str:
    """Auto-detect card company from filename."""
    fn = filename.lower()
    
    # CSV files → generic CSV parser
    if fn.endswith('.csv'):
        return 'csv'
    
    if '롯데' in fn or 'lotte' in fn:
        return 'lotte'
    elif '삼성' in fn or 'samsung' in fn:
        return 'samsung'
    elif '국민은행' in fn or 'kb은행' in fn:
        return 'kookmin_bank'
    elif '수협' in fn or 'suhyup' in fn:
        return 'suhyup_bank'
    elif '신한은행' in fn or '송금' in fn or 'shinhanbank' in fn:
        if fn.endswith('.pdf'):
            return 'shinhan_bank_pdf'
        return 'shinhan_bank'
    elif '신한카드' in fn or '신한' in fn or 'shinhancard' in fn or 'shinhan' in fn:
        return 'shinhan_card'
    elif '현대' in fn or 'hyundai' in fn:
        return 'hyundai'
    return 'unknown'


def parse_csv(filepath: str) -> List[Dict]:
    """
    Parse a generic CSV file for purchase records.
    Auto-detects encoding (UTF-8 or EUC-KR) and column mapping.
    
    Expected columns (flexible matching):
      - 날짜/일자/date → date
      - 거래처/가맹점/업체/vendor/상호 → vendor_name
      - 금액/이용금액/amount/결제금액 → amount
      - 카테고리/분류/category (optional)
    """
    import csv
    
    # Try UTF-8 first, then EUC-KR (common for Korean files)
    content = None
    for encoding in ['utf-8-sig', 'utf-8', 'euc-kr', 'cp949']:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                content = f.read()
            break
        except (UnicodeDecodeError, UnicodeError):
            continue
    
    if content is None:
        return []
    
    lines = content.strip().split('\n')
    if len(lines) < 2:
        return []
    
    reader = csv.reader(lines)
    headers_raw = next(reader)
    headers = [h.strip().lower().replace(' ', '') for h in headers_raw]
    
    # Column mapping — flexible matching
    date_col = None
    vendor_col = None
    amount_col = None
    category_col = None
    
    date_keywords = ['날짜', '일자', 'date', '거래일', '이용일', '결제일']
    vendor_keywords = ['거래처', '가맹점', '업체', '상호', 'vendor', '이용가맹점', '가맹점명', '내용']
    amount_keywords = ['금액', '이용금액', 'amount', '결제금액', '출금', '지출', '이용금액(원)']
    category_keywords = ['카테고리', '분류', 'category', '업종']
    
    for i, h in enumerate(headers):
        if date_col is None and any(k in h for k in date_keywords):
            date_col = i
        if vendor_col is None and any(k in h for k in vendor_keywords):
            vendor_col = i
        if amount_col is None and any(k in h for k in amount_keywords):
            amount_col = i
        if category_col is None and any(k in h for k in category_keywords):
            category_col = i
    
    if date_col is None or amount_col is None:
        # Fallback: assume first=date, second=vendor, third=amount
        if len(headers) >= 3:
            date_col = 0
            vendor_col = 1
            amount_col = 2
        else:
            return []
    
    if vendor_col is None:
        vendor_col = 1 if date_col != 1 else 0
    
    records = []
    for row in reader:
        if len(row) <= max(date_col, vendor_col, amount_col):
            continue
        
        try:
            date_val = _normalize_date(row[date_col].strip())
            if not date_val:
                continue
        except Exception:
            continue
        
        vendor_name = row[vendor_col].strip()
        if not vendor_name:
            continue
        
        amount = _clean_amount(row[amount_col])
        if amount <= 0:
            continue
        
        category = '기타경비'
        if category_col is not None and category_col < len(row) and row[category_col].strip():
            category = row[category_col].strip()
        else:
            category = classify_category(vendor_name)
        
        records.append({
            'date': date_val,
            'vendor_name': vendor_name,
            'amount': amount,
            'category': category,
            'card_company': 'CSV',
            'approval_no': '',
            'business_type': '',
            'is_cancelled': False,
        })
    
    return records


def parse_purchase_file(filepath: str, filename: str = None) -> List[Dict]:
    """
    Parse a purchase Excel/PDF/CSV file and return standardized records.
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
        'shinhan_bank_pdf': parse_shinhan_bank_pdf,
        'kookmin_bank': lambda fp: _parse_generic_bank(fp, '국민은행'),
        'suhyup_bank': lambda fp: _parse_generic_bank(fp, '수협은행'),
        'hyundai': parse_hyundai,
        'csv': parse_csv,
    }

    parser = parsers.get(company)
    if not parser:
        raise ValueError(f"지원하지 않는 카드사/은행 파일입니다: {filename}")

    records = parser(filepath)

    # Filter out cancelled transactions
    active_records = [r for r in records if not r.get('is_cancelled', False)]

    return active_records

