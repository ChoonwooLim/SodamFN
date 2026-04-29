"""호출 카운터 / 일별 한도 / 쿨다운 / 비용 / 월 예산 알림.

DEMO: 일별 100회 한도 (CODEF_DEMO_DAILY_LIMIT env)
PRODUCT: 월 예산 (CodefBudgetSetting 테이블) + 단가표 (CODEF_PRICE_TABLE env)
사용자 버튼: 카드사+API path 별 5분 쿨다운
"""
import datetime
import json
import os
from typing import Optional

from sqlmodel import Session, select, func

from models import CodefCallLog, CodefBudgetSetting
from .exceptions import CodefQuotaExceeded


COOLDOWN_MINUTES = 5


class CodefQuotaService:
    def __init__(self, engine):
        self.engine = engine

    # ─── 환경 설정 ─────────────────────────────────

    @property
    def demo_daily_limit(self) -> int:
        return int(os.getenv("CODEF_DEMO_DAILY_LIMIT", "100"))

    @property
    def price_table(self) -> dict:
        try:
            return json.loads(os.getenv("CODEF_PRICE_TABLE", "{}"))
        except json.JSONDecodeError:
            return {}

    @property
    def env(self) -> str:
        return os.getenv("CODEF_ENV", "demo")

    # ─── 호출 전 가드 ──────────────────────────────

    def check_before_call(self, business_id: int, api_path: str) -> None:
        """위반 시 CodefQuotaExceeded 예외."""
        if self.env == "demo":
            today = datetime.date.today()
            count = self._count_today(business_id, today)
            if count >= self.demo_daily_limit:
                raise CodefQuotaExceeded(
                    scope="daily", current=count, limit=self.demo_daily_limit
                )
        elif self.env == "production":
            self._check_monthly_budget(business_id)

    def check_cooldown(self, business_id: int, organization_code: str,
                       api_path: str) -> None:
        """수동 호출 전용 5분 쿨다운."""
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=COOLDOWN_MINUTES)
        with Session(self.engine) as s:
            stmt = (
                select(CodefCallLog)
                .where(
                    CodefCallLog.business_id == business_id,
                    CodefCallLog.organization_code == organization_code,
                    CodefCallLog.api_path == api_path,
                    CodefCallLog.called_at >= cutoff,
                )
                .limit(1)
            )
            recent = s.exec(stmt).first()
            if recent:
                raise CodefQuotaExceeded(
                    scope="cooldown", current=1, limit=0
                )

    # ─── 호출 후 기록 ──────────────────────────────

    def record_call(self, business_id: int, connection_id: Optional[int],
                    api_path: str, organization_code: Optional[str], status: str,
                    rows: int, result_code: str, triggered_by: str,
                    triggered_user_id: Optional[int] = None) -> None:
        cost = self._compute_cost(api_path)
        log = CodefCallLog(
            business_id=business_id,
            connection_id=connection_id,
            api_path=api_path,
            organization_code=organization_code,
            status=status,
            rows_returned=rows,
            result_code=result_code,
            estimated_cost_krw=cost,
            triggered_by=triggered_by,
            triggered_user_id=triggered_user_id,
        )
        with Session(self.engine) as s:
            s.add(log)
            s.commit()

    def _compute_cost(self, api_path: str) -> Optional[int]:
        if self.env != "production":
            return 0
        return self.price_table.get(api_path, 0)

    # ─── 월 예산 ───────────────────────────────────

    def _check_monthly_budget(self, business_id: int) -> None:
        with Session(self.engine) as s:
            setting = s.exec(
                select(CodefBudgetSetting).where(
                    CodefBudgetSetting.business_id == business_id
                )
            ).first()
            if not setting or setting.monthly_budget_krw == 0:
                return  # 예산 미설정 = 무제한
            current_cost = self._sum_month_cost(s, business_id)
            hard_limit = setting.monthly_budget_krw * setting.hard_limit_pct // 100
            if current_cost >= hard_limit:
                raise CodefQuotaExceeded(
                    scope="monthly_budget",
                    current=current_cost,
                    limit=hard_limit,
                )

    def _sum_month_cost(self, session: Session, business_id: int) -> int:
        first_of_month = datetime.date.today().replace(day=1)
        stmt = select(func.coalesce(func.sum(CodefCallLog.estimated_cost_krw), 0)).where(
            CodefCallLog.business_id == business_id,
            CodefCallLog.called_date >= first_of_month,
        )
        return session.exec(stmt).first() or 0

    # ─── 카운터 ────────────────────────────────────

    def _count_today(self, business_id: int, today: datetime.date) -> int:
        with Session(self.engine) as s:
            stmt = select(func.count(CodefCallLog.id)).where(
                CodefCallLog.business_id == business_id,
                CodefCallLog.called_date == today,
            )
            return s.exec(stmt).first() or 0

    # ─── 예산 알림 트리거 ──────────────────────────

    def check_budget_alerts(self, business_id: int) -> Optional[str]:
        """월 예산 임계 도달 검사.

        반환값:
        - 'warning': 80% 도달 (이번 달 첫 발송)
        - 'hardlimit': 100% 도달 (이번 달 첫 발송)
        - None: 임계 미도달 또는 이미 발송함
        """
        if self.env != "production":
            return None
        with Session(self.engine) as s:
            setting = s.exec(
                select(CodefBudgetSetting).where(
                    CodefBudgetSetting.business_id == business_id
                )
            ).first()
            if not setting or setting.monthly_budget_krw == 0:
                return None

            now = datetime.datetime.utcnow()
            first_of_month = datetime.date.today().replace(day=1)

            if setting.current_month_first_day != first_of_month:
                setting.current_month_first_day = first_of_month
                setting.last_warning_sent_at = None
                setting.last_hardlimit_sent_at = None
                s.add(setting)
                s.commit()

            current = self._sum_month_cost(s, business_id)
            warning = setting.monthly_budget_krw * setting.warning_threshold_pct // 100
            hardlimit = setting.monthly_budget_krw * setting.hard_limit_pct // 100

            if current >= hardlimit and not setting.last_hardlimit_sent_at:
                setting.last_hardlimit_sent_at = now
                # 100% 도달 = warning 도 자동 마킹 (별도 발송 X)
                if not setting.last_warning_sent_at:
                    setting.last_warning_sent_at = now
                s.add(setting)
                s.commit()
                return "hardlimit"
            if current >= warning and not setting.last_warning_sent_at:
                setting.last_warning_sent_at = now
                s.add(setting)
                s.commit()
                return "warning"
            return None

    # ─── 대시보드 ──────────────────────────────────

    def current_month_summary(self, business_id: int) -> dict:
        first_of_month = datetime.date.today().replace(day=1)
        with Session(self.engine) as s:
            stmt = select(
                func.count(CodefCallLog.id),
                func.coalesce(func.sum(CodefCallLog.estimated_cost_krw), 0),
            ).where(
                CodefCallLog.business_id == business_id,
                CodefCallLog.called_date >= first_of_month,
            )
            total_calls, total_cost = s.exec(stmt).first()

            org_stmt = (
                select(
                    CodefCallLog.organization_code,
                    func.count(CodefCallLog.id),
                    func.coalesce(func.sum(CodefCallLog.estimated_cost_krw), 0),
                )
                .where(
                    CodefCallLog.business_id == business_id,
                    CodefCallLog.called_date >= first_of_month,
                )
                .group_by(CodefCallLog.organization_code)
            )
            by_org = [
                {"organization_code": row[0], "calls": row[1], "cost_krw": row[2]}
                for row in s.exec(org_stmt).all()
            ]

        return {
            "total_calls": total_calls or 0,
            "total_cost_krw": total_cost or 0,
            "by_organization": by_org,
            "first_of_month": first_of_month.isoformat(),
            "env": self.env,
            "demo_daily_limit": self.demo_daily_limit if self.env == "demo" else None,
        }
