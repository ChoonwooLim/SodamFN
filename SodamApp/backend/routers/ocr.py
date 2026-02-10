from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from services.ocr_service import OCRService
from routers.auth import get_admin_user
from models import User

router = APIRouter()

@router.post("/ocr/upload")
async def upload_receipt(file: UploadFile = File(...), _admin: User = Depends(get_admin_user)):
    try:
        content = await file.read()
        service = OCRService()
        result = service.process_image(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
