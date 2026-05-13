"""EasyPosSaleReceipt → SyncEvent[] (결제수단별 분해).

자세한 매핑은 spec § 5.3 참조.
"""
import datetime
from sqlmodel import Session, select
from models import EasyPosSaleReceipt
from ..sync_event import SyncEvent


PAYMENT_METHOD_COLUMNS = {
    "Cash": "cash_amount",
    "Card": "card_amount",
    "Point": "point_amount",
    "Voucher": "voucher_amount",
    "Cashback": "cashback_amount",
    "Prepaid": "prepaid_card_amount",
    "Credit": "credit_amount",
    "Exchange": "exchange_voucher_amount",
    "EmployeeCard": "employee_card_amount",
    "EMoney": "e_money_amount",
}


def normalize_easypos(session: Session, business_id: int,
                      start: datetime.date, end: datetime.date):
    """기간 내 일자별로 결제수단별 합계 SyncEvent yield."""
    current = start
    while current <= end:
        receipts = session.exec(
            select(EasyPosSaleReceipt).where(
                EasyPosSaleReceipt.business_id == business_id,
                EasyPosSaleReceipt.sale_date == current,
            )
        ).all()
        for pm, col in PAYMENT_METHOD_COLUMNS.items():
            total = sum(getattr(r, col, 0) or 0 for r in receipts)
            if total <= 0:
                continue
            yield SyncEvent(
                business_id=business_id, date=current,
                event_type="revenue", vendor_lookup_key="store",
                payment_method=pm, amount=int(total),
                source="auto_easypos",
                source_ref=f"easypos:{business_id}:{current.isoformat()}:{pm}",
                raw_payload={"receipt_count": len(receipts), "payment_method": pm},
            )
        current += datetime.timedelta(days=1)
