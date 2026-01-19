from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel import Session, select, func
from typing import List, Optional
from datetime import date
from models import CardSalesApproval, CardPayment
from services.database_service import DatabaseService
from services.financial_parser import parse_sales_approval, parse_payment_history
from routers.auth import get_current_user
from sqlalchemy import text # Use sqlalchemy text for complex dates if needed

router = APIRouter()

@router.post("/upload/sales")
async def upload_sales_approval(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    service = DatabaseService()
    try:
        data = parse_sales_approval(file)
        if not data:
            raise HTTPException(status_code=400, detail="Failed to parse file or empty data")
        
        count = 0
        for item in data:
            # Upsert check (by approval number + date)
            existing = service.session.exec(
                select(CardSalesApproval).where(
                    CardSalesApproval.approval_number == item["approval_number"],
                    CardSalesApproval.approval_date == item["approval_date"]
                )
            ).first()
            
            if not existing:
                new_sales = CardSalesApproval(**item)
                service.session.add(new_sales)
                count += 1
                
        service.session.commit()
        return {"status": "success", "message": f"{count} new sales records imported"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        service.close()

@router.post("/upload/payment")
async def upload_card_payment(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    service = DatabaseService()
    try:
        data = parse_payment_history(file)
        if not data:
            raise HTTPException(status_code=400, detail="Failed to parse file or empty data")
        
        count = 0
        for item in data:
            # Upsert check (by payment_date + card_corp + net_deposit) - heuristic key
            existing = service.session.exec(
                select(CardPayment).where(
                    CardPayment.payment_date == item["payment_date"],
                    CardPayment.card_corp == item["card_corp"],
                    CardPayment.net_deposit == item["net_deposit"]
                )
            ).first()
            
            if not existing:
                new_payment = CardPayment(**item)
                service.session.add(new_payment)
                count += 1
        
        service.session.commit()
        return {"status": "success", "message": f"{count} payment records imported"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        service.close()

@router.get("/stats/sales")
def get_sales_stats(start_date: date, end_date: date, current_user = Depends(get_current_user)):
    service = DatabaseService()
    try:
        # Group by Date
        sales_by_date = service.session.exec(
            select(
                CardSalesApproval.approval_date,
                func.sum(CardSalesApproval.amount).label("total"),
                func.count(CardSalesApproval.id).label("count")
            )
            .where(CardSalesApproval.approval_date >= start_date)
            .where(CardSalesApproval.approval_date <= end_date)
            .group_by(CardSalesApproval.approval_date)
            .order_by(CardSalesApproval.approval_date)
        ).all()
        
        # Group by Card Corp
        sales_by_corp = service.session.exec(
            select(
                CardSalesApproval.card_corp,
                func.sum(CardSalesApproval.amount).label("total")
            )
            .where(CardSalesApproval.approval_date >= start_date)
            .where(CardSalesApproval.approval_date <= end_date)
            .group_by(CardSalesApproval.card_corp)
        ).all()
        
        return {
            "status": "success",
            "daily_trend": [{"date": r[0], "total": r[1], "count": r[2]} for r in sales_by_date],
            "by_corp": [{"name": r[0], "value": r[1]} for r in sales_by_corp]
        }
    finally:
        service.close()

@router.get("/stats/payment")
def get_payment_stats(start_date: date, end_date: date, current_user = Depends(get_current_user)):
    service = DatabaseService()
    try:
        payments = service.session.exec(
            select(CardPayment)
            .where(CardPayment.payment_date >= start_date)
            .where(CardPayment.payment_date <= end_date)
            .order_by(CardPayment.payment_date)
        ).all()
        
        return {"status": "success", "data": payments}
    finally:
        service.close()
