from fastapi import APIRouter
from .image import router as image_router
from .excel import router as excel_router
from .history import router as history_router

router = APIRouter()
router.include_router(image_router)
router.include_router(excel_router)
router.include_router(history_router)
