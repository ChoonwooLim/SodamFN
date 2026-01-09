from fastapi import APIRouter, UploadFile, File, HTTPException
from services.ocr_service import OCRService

router = APIRouter()

@router.post("/ocr/upload")
async def upload_receipt(file: UploadFile = File(...)):
    try:
        content = await file.read()
        service = OCRService()
        result = service.process_image(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
