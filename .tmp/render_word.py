from pathlib import Path

import fitz
import win32com.client


root = Path(r"C:\WORK\SodamFN")
docx_path = root / "docs" / "marketing" / "SEMHANA_홍보영상_제작기획서.docx"
out_dir = root / ".tmp" / "promo_render_word"
out_dir.mkdir(parents=True, exist_ok=True)
pdf_path = out_dir / "SEMHANA_promo_video_plan.pdf"

word = win32com.client.DispatchEx("Word.Application")
word.Visible = False
word.DisplayAlerts = 0
try:
    doc = word.Documents.Open(str(docx_path), ReadOnly=True, AddToRecentFiles=False)
    doc.ExportAsFixedFormat(
        OutputFileName=str(pdf_path),
        ExportFormat=17,
        OpenAfterExport=False,
        OptimizeFor=0,
        Range=0,
        Item=0,
        IncludeDocProps=True,
        KeepIRM=True,
        CreateBookmarks=1,
        DocStructureTags=True,
        BitmapMissingFonts=True,
        UseISO19005_1=False,
    )
    doc.Close(False)
finally:
    word.Quit()

pdf = fitz.open(pdf_path)
matrix = fitz.Matrix(2, 2)
for index, page in enumerate(pdf):
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    pix.save(out_dir / f"page-{index + 1}.png")
print(f"{len(pdf)} pages rendered to {out_dir}")
