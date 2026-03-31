import fitz  # PyMuPDF
import sys

files = [
    r"D:\GoogleDrive\소담김밥\0_급여대장및관련세금\2026급여및세금\3월급여\1774917375661_3월 일용직대장(소담김밥).pdf",
    r"D:\GoogleDrive\소담김밥\0_급여대장및관련세금\2026급여및세금\3월급여\1774917375664_3월 급여명세서(소담김밥).pdf",
    r"D:\GoogleDrive\소담김밥\0_급여대장및관련세금\2026급여및세금\3월급여\1774917375665_3월 사업소득대장(소담김밥).pdf"
]

with open("pdf_output_utf8.txt", "w", encoding="utf-8") as f:
    for file in files:
        f.write(f"\n--- Extracting {file} ---\n")
        try:
            doc = fitz.open(file)
            for page in doc:
                f.write(page.get_text())
        except Exception as e:
            f.write(f"Error: {e}\n")
