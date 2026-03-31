import pdfplumber

files = [
    r"D:\GoogleDrive\소담김밥\0_급여대장및관련세금\2026급여및세금\3월급여\퇴직금산정(허윤희).pdf",
    r"D:\GoogleDrive\소담김밥\0_급여대장및관련세금\2026급여및세금\3월급여\소담김밥_13_허윤희_2026_근로소득원천징수영수증_소득자보관용.pdf"
]

for path in files:
    try:
        print(f"\n{'='*50}\n  {path.split('\\')[-1]}\n{'='*50}")
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                print(f"--- Page {i+1} ---")
                print(text)
    except Exception as e:
        print(f"Error reading {path}: {e}")
