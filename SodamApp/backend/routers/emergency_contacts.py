from fastapi import APIRouter, HTTPException, Depends, Body
from routers.auth import get_current_user, get_admin_user
from models import User as AuthUser, EmergencyContact
from services.database_service import DatabaseService
from sqlmodel import select

router = APIRouter(prefix="/emergency-contacts", tags=["Emergency Contacts"])


@router.get("")
def get_contacts(_user: AuthUser = Depends(get_current_user)):
    service = DatabaseService()
    try:
        contacts = service.session.exec(
            select(EmergencyContact).order_by(EmergencyContact.display_order, EmergencyContact.id)
        ).all()
        return {
            "status": "success",
            "data": [
                {"id": c.id, "name": c.name, "phone": c.phone, "category": c.category, "display_order": c.display_order}
                for c in contacts
            ]
        }
    finally:
        service.close()


@router.post("")
def create_contact(
    name: str = Body(..., embed=True),
    phone: str = Body(..., embed=True),
    category: str = Body("", embed=True),
    display_order: int = Body(0, embed=True),
    _admin: AuthUser = Depends(get_admin_user)
):
    service = DatabaseService()
    try:
        contact = EmergencyContact(name=name, phone=phone, category=category, display_order=display_order)
        service.session.add(contact)
        service.session.commit()
        service.session.refresh(contact)
        return {"status": "success", "data": {"id": contact.id, "name": contact.name, "phone": contact.phone, "category": contact.category}}
    finally:
        service.close()


@router.put("/{contact_id}")
def update_contact(
    contact_id: int,
    name: str = Body(None, embed=True),
    phone: str = Body(None, embed=True),
    category: str = Body(None, embed=True),
    display_order: int = Body(None, embed=True),
    _admin: AuthUser = Depends(get_admin_user)
):
    service = DatabaseService()
    try:
        contact = service.session.get(EmergencyContact, contact_id)
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        if name is not None: contact.name = name
        if phone is not None: contact.phone = phone
        if category is not None: contact.category = category
        if display_order is not None: contact.display_order = display_order
        service.session.add(contact)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()


@router.delete("/{contact_id}")
def delete_contact(contact_id: int, _admin: AuthUser = Depends(get_admin_user)):
    service = DatabaseService()
    try:
        contact = service.session.get(EmergencyContact, contact_id)
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        service.session.delete(contact)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()
