"""Orchestrator stub — Task 8 에서 본격 구현."""
from dataclasses import dataclass, field
from sqlmodel import Session


@dataclass
class OrchestratorReport:
    business_id: int
    total_events: int = 0
    counts: dict = field(default_factory=dict)
    skipped_reason: str = ""


def run_one_business(session: Session, business_id: int, **kwargs) -> OrchestratorReport:
    """기간 한 사업장 동기화. Task 8 에서 normalizer/fan_out 연결."""
    return OrchestratorReport(business_id=business_id, total_events=0)


def run_all_businesses(session: Session) -> list[OrchestratorReport]:
    return []
