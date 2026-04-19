from fastapi import APIRouter

from .staff import router as staff_router
from .attendance import router as attendance_router
from .location import router as location_router
from .retirement import router as retirement_router
from .leave import router as leave_router

router = APIRouter()

router.include_router(staff_router)
router.include_router(attendance_router)
router.include_router(location_router)
router.include_router(retirement_router)
router.include_router(leave_router)
