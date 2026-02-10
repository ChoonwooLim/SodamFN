from fastapi import APIRouter, HTTPException, Body, Depends
from sqlmodel import select
from models import GlobalSetting, User
from services.database_service import DatabaseService
from pydantic import BaseModel
from routers.auth import get_admin_user

router = APIRouter(
    prefix="/api/settings",
    tags=["settings"]
)

class SettingUpdate(BaseModel):
    value: str

@router.get("/{key}")
def get_setting(key: str, _admin: User = Depends(get_admin_user)):
    service = DatabaseService()
    try:
        setting = service.session.get(GlobalSetting, key)
        if not setting:
            return {"key": key, "value": None}
        return setting
    finally:
        service.close()

@router.put("/{key}")
def update_setting(key: str, data: SettingUpdate, _admin: User = Depends(get_admin_user)):
    service = DatabaseService()
    try:
        setting = service.session.get(GlobalSetting, key)
        if not setting:
            setting = GlobalSetting(key=key, value=data.value)
            service.session.add(setting)
        else:
            setting.value = data.value
            service.session.add(setting)
        
        service.session.commit()
        service.session.refresh(setting)
        return setting
    finally:
        service.close()
