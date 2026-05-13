"""표준 SyncEvent DTO — 채널 normalizer 출력 형식.

자세한 의미는 spec § 5.2 참조.
"""
from dataclasses import dataclass, field
from datetime import date
from typing import Literal


EventType = Literal["revenue", "expense", "card_settlement", "delivery_settlement"]


@dataclass
class SyncEvent:
    business_id: int
    date: date
    event_type: EventType
    vendor_lookup_key: str
    payment_method: str
    amount: int                        # revenue +, expense -
    source: str                        # 'auto_easypos' | 'auto_coupang' | 'auto_bank' | ...
    source_ref: str
    raw_payload: dict = field(default_factory=dict)
