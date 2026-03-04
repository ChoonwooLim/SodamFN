"""
Extract key figures from year-end tax settlement PDFs.
Focus on: 결정세액, 기납부세액, 차감징수세액, 총급여, 주민번호(생년월일)
"""
import pdfplumber
import re

files = [
    (r'D:\GoogleDrive\소담김밥\직원급여\2025연말정산\소담김밥_12_김금순(JINJINSHUN)_2025_근로소득원천징수영수증_소득자보관용.pdf', '김금순'),
    (r'D:\GoogleDrive\소담김밥\직원급여\2025연말정산\소담김밥_13_허윤희_2025_근로소득원천징수영수증_소득자보관용.pdf', '허윤희'),
    (r'D:\GoogleDrive\소담김밥\직원급여\2025연말정산\소담김밥_14_정명주_2025_근로소득원천징수영수증_소득자보관용.pdf', '정명주'),
    (r'D:\GoogleDrive\소담김밥\직원급여\2025연말정산\소담김밥_15_정수현_2025_근로소득원천징수영수증_소득자보관용.pdf', '정수현'),
]

for path, name in files:
    print(f"\n{'='*50}")
    print(f"  {name}")
    print(f"{'='*50}")
    
    all_text = ""
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            all_text += text + "\n"
    
    # Extract 주민번호 (birth date)
    rr_match = re.findall(r'등록번호\s+(\d{6})-', all_text)
    if rr_match:
        for rr in rr_match:
            # Parse birth date from 주민번호
            yy = int(rr[:2])
            mm = int(rr[2:4])
            dd = int(rr[4:6])
            year = 1900 + yy if yy >= 30 else 2000 + yy
            print(f"  주민번호: {rr}-... -> 생년월일: {year}-{mm:02d}-{dd:02d}")
    
    # Extract 총급여
    total_pay_match = re.findall(r'(\d{1,3}(?:,\d{3})+)\s+(\d{1,3}(?:,\d{3})+)\s*$', all_text, re.MULTILINE)
    
    # Extract key tax figures using patterns
    # 결정세액
    for pattern in [r'결정세액\s+([\d,]+)\s+([\d,]+)', r'결정세액.*?(\d[\d,]+)\s+([\d,]+)']:
        match = re.search(pattern, all_text)
        if match:
            print(f"  결정세액: 소득세={match.group(1)} 지방소득세={match.group(2)}")
            break
    
    # 기납부세액 (주현근무지)
    for pattern in [r'주\(현\)근무지\s+([\d,]+)\s+([\d,]+)', r'주.현.근무지\s+([\d,]+)\s+([\d,]+)']:
        match = re.search(pattern, all_text)
        if match:
            print(f"  기납부세액(주현): 소득세={match.group(1)} 지방소득세={match.group(2)}")
            break
    
    # 차감징수세액
    for pattern in [r'차감징수세액.*?([-\d,]+)\s+([-\d,]+)', r'차감징수.*?([-]?[\d,]+)\s+([-]?[\d,]+)']:
        match = re.search(pattern, all_text)
        if match:
            print(f"  차감징수세액: 소득세={match.group(1)} 지방소득세={match.group(2)}")
            break
    
    # 총급여
    for pattern in [r'총급여.*?(\d[\d,]+)', r'33,600,000']:
        match = re.search(pattern, all_text)
        if match:
            if hasattr(match, 'group') and match.lastindex:
                print(f"  총급여: {match.group(1)}")
            break
    
    # 국민연금, 건강보험, 고용보험 totals
    for label, pattern in [
        ('국민연금', r'국민연금보험료[:\s]+([\d,]+)'),
        ('건강보험', r'국민건강보험료[:\s]+([\d,]+)'),
        ('장기요양', r'장기요양보험료[:\s]+([\d,]+)'),
        ('고용보험', r'고용보험료[:\s]+([\d,]+)'),
    ]:
        match = re.search(pattern, all_text)
        if match:
            print(f"  {label}: {match.group(1)}")
    
    # 근무기간
    period_match = re.search(r'근무기간\s+([\d.]+)\s*~\s*([\d.]+)', all_text)
    if period_match:
        print(f"  근무기간: {period_match.group(1)} ~ {period_match.group(2)}")
