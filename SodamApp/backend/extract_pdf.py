from pypdf import PdfReader

reader = PdfReader(r"C:\WORK\SodamFN\2025실소득분석\2025근로계약서(소담김밥).pdf")
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

with open("contract_template.txt", "w", encoding="utf-8") as f:
    f.write(text)
