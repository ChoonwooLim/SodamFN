import PyPDF2
import sys

def extract_text(pdf_path):
    print(f"--- Extracting {pdf_path} ---")
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            print(text)
    except Exception as e:
        print(f"Error extracting {pdf_path}: {e}")
        try:
            import fitz
            doc = fitz.open(pdf_path)
            for page in doc:
                print(page.get_text())
        except Exception as e2:
            print(f"Fallback extraction failed: {e2}")

files = [
    r"D:\GoogleDrive\소담김밥\0_급여대장및관련세금\2026급여및세금\3월급여\1774917375661_3월 일용직대장(소담김밥).pdf",
    r"D:\GoogleDrive\소담김밥\0_급여대장및관련세금\2026급여및세금\3월급여\1774917375664_3월 급여명세서(소담김밥).pdf",
    r"D:\GoogleDrive\소담김밥\0_급여대장및관련세금\2026급여및세금\3월급여\1774917375665_3월 사업소득대장(소담김밥).pdf"
]

for file in files:
    extract_text(file)
