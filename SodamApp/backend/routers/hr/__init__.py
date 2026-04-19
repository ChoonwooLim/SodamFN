from fastapi import APIRouter

from .staff import router as staff_router
from .attendance import router as attendance_router
from .location import router as location_router
from .retirement import router as retirement_router
from .leave import router as leave_router
from .changelog import router as changelog_router
from .worktime import router as worktime_router
from .training import router as training_router
from .alerts import router as alerts_router
from .certificate import router as certificate_router

router = APIRouter()

router.include_router(staff_router)
router.include_router(attendance_router)
router.include_router(location_router)
router.include_router(retirement_router)
router.include_router(leave_router)
router.include_router(changelog_router)
router.include_router(worktime_router)
router.include_router(training_router)
router.include_router(alerts_router)
router.include_router(certificate_router)
