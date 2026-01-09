from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.excel_service import ExcelService

router = APIRouter()

class ExpenseItem(BaseModel):
    date: str
    item: str
    amount: int
    category: str = "기타"

@router.post("/expense")
def add_expense(item: ExpenseItem):
    try:
        service = ExcelService()
        result = service.add_expense(item.date, item.item, item.amount, item.category)
        if result.get("status") == "error":
             raise HTTPException(status_code=400, detail=result.get("message"))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
