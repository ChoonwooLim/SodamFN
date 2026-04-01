from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select

from routers.auth import get_admin_user
from models import User as AuthUser, WorkLocation
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    latitude: float
    longitude: float
    radius_meters: int = 100

@router.get("/location")
def get_work_location(_admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    stmt = apply_bid_filter(select(WorkLocation), WorkLocation, bid).where(WorkLocation.is_active == True)
    location = session.exec(stmt).first()
    if not location:
        return {"status": "success", "data": None, "message": "매장 위치가 설정되지 않았습니다."}
    return {
        "status": "success",
        "data": {
            "id": location.id,
            "name": location.name,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "radius_meters": location.radius_meters,
            "is_active": location.is_active,
        }
    }

@router.post("/location")
def set_work_location(data: LocationUpdate, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    stmt = apply_bid_filter(select(WorkLocation), WorkLocation, bid).where(WorkLocation.is_active == True)
    existing = session.exec(stmt).first()
    
    if existing:
        existing.latitude = data.latitude
        existing.longitude = data.longitude
        existing.radius_meters = data.radius_meters
        if data.name:
            existing.name = data.name
        session.add(existing)
    else:
        new_loc = WorkLocation(
            name=data.name or "소담김밥",
            latitude=data.latitude,
            longitude=data.longitude,
            radius_meters=data.radius_meters,
            business_id=bid
        )
        session.add(new_loc)
    
    session.commit()
    return {"status": "success", "message": f"매장 위치가 설정되었습니다. (반경 {data.radius_meters}m)"}
