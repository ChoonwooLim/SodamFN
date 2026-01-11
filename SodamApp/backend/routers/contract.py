from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlmodel import select
from models import ElectronicContract, Staff, User
from services.database_service import DatabaseService
from routers.auth import get_current_user, get_admin_user

router = APIRouter()

class ContractCreate(BaseModel):
    staff_id: int
    title: str
    content: str

class ContractSign(BaseModel):
    signature_data: str # Base64 string

@router.post("/")
def create_contract(contract: ContractCreate, admin: User = Depends(get_admin_user)):
    service = DatabaseService()
    try:
        new_contract = ElectronicContract(
            staff_id=contract.staff_id,
            title=contract.title,
            content=contract.content
        )
        service.session.add(new_contract)
        service.session.commit()
        service.session.refresh(new_contract)
        return {"status": "success", "data": new_contract}
    finally:
        service.close()

@router.get("/my")
def get_my_contracts(current_user: User = Depends(get_current_user)):
    if not current_user.staff_id:
        raise HTTPException(status_code=400, detail="User is not linked to a staff record")
    
    service = DatabaseService()
    try:
        stmt = select(ElectronicContract).where(ElectronicContract.staff_id == current_user.staff_id)
        contracts = service.session.exec(stmt).all()
        return {"status": "success", "data": contracts}
    finally:
        service.close()

@router.get("/{contract_id}")
def get_contract_detail(contract_id: int, current_user: User = Depends(get_current_user)):
    service = DatabaseService()
    try:
        contract = service.session.get(ElectronicContract, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        
        # Security: Only admin or the staff member themselves can view
        if current_user.role != "admin" and current_user.staff_id != contract.staff_id:
            raise HTTPException(status_code=403, detail="Permission denied")
            
        return {"status": "success", "data": contract}
    finally:
        service.close()

@router.post("/{contract_id}/sign")
def sign_contract(contract_id: int, sign_data: ContractSign, current_user: User = Depends(get_current_user)):
    service = DatabaseService()
    try:
        contract = service.session.get(ElectronicContract, contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        
        if current_user.staff_id != contract.staff_id:
            raise HTTPException(status_code=403, detail="Only the assigned staff can sign this contract")
            
        if contract.status == "signed":
            raise HTTPException(status_code=400, detail="Contract already signed")
            
        contract.signature_data = sign_data.signature_data
        contract.status = "signed"
        contract.signed_at = datetime.now()
        
        service.session.add(contract)
        service.session.commit()
        return {"status": "success", "message": "Contract signed successfully"}
    finally:
        service.close()

@router.get("/staff/{staff_id}")
def get_staff_contracts(staff_id: int, admin: User = Depends(get_admin_user)):
    service = DatabaseService()
    try:
        stmt = select(ElectronicContract).where(ElectronicContract.staff_id == staff_id)
        contracts = service.session.exec(stmt).all()
        return {"status": "success", "data": contracts}
    finally:
        service.close()
