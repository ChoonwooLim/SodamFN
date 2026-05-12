"""이지포스 (KICC smart.easypos.net) 매출 자동수집 어댑터.

KICC 가 공식 Open API 를 제공하지 않으므로 가맹점주 권한 세션을 사용한
비공개 XHR endpoint 를 호출. 가맹점주 본인 데이터를 가맹점주 권한으로 조회 →
약관 위반 위험은 낮으나, KICC 가 user-agent 차단/CAPTCHA 도입 시 갱신 필요.

전송 포맷: Nexacro PlatformData SSV (services.nexacro_ssv)
응답 포맷: 동일 SSV
세션:    JSESSIONID 쿠키 (httpx.Client 자동 관리)

본 어댑터는 단일 사장님 단일 매장 가정. 향후 멀티 매장 운영 시 shopNo 분리.
"""
from __future__ import annotations

import datetime
import json
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from services.nexacro_ssv import RS, US, build_ssv_request, parse_ssv, SsvResponse


BASE_URL = "https://smart.easypos.net"
DEFAULT_TIMEOUT = 30.0

log = logging.getLogger("easypos")


class EasyPosError(Exception):
    """이지포스 호출 실패. msg + 가능하면 SSV error_code."""
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message)
        self.error_code = error_code


@dataclass
class LoginResult:
    ok: bool
    shop_name: Optional[str] = None
    erp_shop_code: Optional[str] = None
    head_office_no: Optional[str] = None
    user_name: Optional[str] = None
    raw_login_info: dict = field(default_factory=dict)
    error_message: Optional[str] = None


@dataclass
class DailySalesResult:
    sale_date: datetime.date
    receipts: list[dict] = field(default_factory=list)
    total_sales: int = 0
    receipt_count: int = 0


class EasyPosClient:
    """이지포스 매장주 세션 클라이언트. 인스턴스당 1매장.

    사용:
        with EasyPosClient() as c:
            res = c.login(easypos_id, password)
            sales = c.fetch_daily_sales(easypos_id, date(2026,5,12))
    """

    def __init__(self, base_url: str = BASE_URL, timeout: float = DEFAULT_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/148.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            },
        )
        self._logged_in = False
        self._easypos_id: Optional[str] = None

    def __enter__(self) -> "EasyPosClient":
        return self

    def __exit__(self, *exc):
        self.close()

    def close(self):
        try:
            self._client.close()
        except Exception:
            pass

    # ───── 내부 HTTP 헬퍼 ────────────────────────────────────

    def _ssv_post(self, path: str, params: dict[str, str],
                  *, datasets: Optional[dict] = None) -> SsvResponse:
        """SSV 형식 POST. 응답도 SSV.

        HAR 분석 기준 헤더 — Content-Type: text/xml, Accept: application/xml,
        X-Requested-With: XMLHttpRequest 가 필수. (이지포스가 XHR 만 허용)
        """
        body = build_ssv_request(params, datasets=datasets)
        url = f"{path}?inSecureMode=1&outSecureMode=1"
        try:
            r = self._client.post(
                url,
                content=body.encode("utf-8"),
                headers={
                    "Content-Type": "text/xml",
                    "Accept": "application/xml, text/xml, */*",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": self.base_url,
                    "Referer": f"{self.base_url}/easyposnx/index.html",
                    "Cache-Control": "no-cache, no-store",
                    "Pragma": "no-cache",
                },
            )
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise EasyPosError(f"이지포스 통신 실패 [{path}]: {e}") from e

        resp = parse_ssv(r.text)
        if not resp.ok:
            raise EasyPosError(
                f"이지포스 응답 오류 [{path}]: {resp.error_msg or 'unknown'}",
                error_code=resp.error_code,
            )
        return resp

    # ───── 로그인 ────────────────────────────────────────────

    def login(self, easypos_id: str, password: str) -> LoginResult:
        """이지포스 로그인 — JSESSIONID 발급.

        실제 로그인 endpoint 는 사장님 추가 HAR 캡처 후 정확히 확정. 현재는
        가장 가능성 높은 두 후보를 순차 시도:

        1) /cm/loginAction.do (SSV)
        2) /cm/login.do        (SSV)

        둘 다 실패 시 마지막 시도 응답을 그대로 raise.
        """
        login_params = {
            "USER_ID": easypos_id,
            "USER_PW": password,
            "ADMIN_FG": "0",
            "CHK_ID": easypos_id,
        }
        candidates = ["/cm/loginAction.do", "/cm/login.do", "/cm/checkLogin.do"]

        last_err: Optional[Exception] = None
        for path in candidates:
            try:
                resp = self._ssv_post(path, login_params)
                # 응답에 SHOP_NAME 등이 있으면 성공
                info = (resp.first("gdsLoginInfo") or resp.first("dsLoginInfo")
                        or resp.first("dsOut") or {})
                if info.get("SHOP_NAME") or info.get("USER_ID"):
                    self._logged_in = True
                    self._easypos_id = easypos_id
                    return LoginResult(
                        ok=True,
                        shop_name=info.get("SHOP_NAME"),
                        erp_shop_code=info.get("ERP_SHOP_CODE"),
                        head_office_no=info.get("HEAD_OFFICE_NO"),
                        user_name=info.get("USER_NM"),
                        raw_login_info=info,
                    )
            except EasyPosError as e:
                last_err = e
                log.info("login candidate %s failed: %s", path, e)

        # 모두 실패 — 사장님께 정확한 endpoint 안내 요청 필요
        msg = f"로그인 endpoint 미확정 — 사장님 HAR 추가 캡처 필요 (last: {last_err})"
        return LoginResult(ok=False, error_message=msg)

    def check_session(self) -> bool:
        """기존 세션이 살아있는지 확인. checkLoginStatus 는 ID/PW 없이 호출 가능."""
        try:
            resp = self._ssv_post("/cm/checkLoginStatus.do", {
                "CHK_ID": "",
            })
            info = resp.first("gdsLoginInfo")
            return bool(info and info.get("SHOP_NAME"))
        except EasyPosError:
            return False

    # ───── 매출 조회 ─────────────────────────────────────────

    def fetch_daily_sales(self, easypos_id: str, sale_date: datetime.date,
                          shop_no: str = "", pos_no: str = "",
                          sale_fg: str = "") -> DailySalesResult:
        """일별 영수증 단위 매출 조회.

        Args:
            easypos_id: 가맹점 로그인 ID (보통 사업자번호)
            sale_date: 조회 영업일자
            shop_no: 특정 매장 (멀티매장 시), 빈값=전체
            pos_no: 특정 POS, 빈값=전체
            sale_fg: 매출구분, 빈값=전체
        """
        params = {
            "easyposid": easypos_id,
            "shopNo": shop_no,
            "saleDate": sale_date.strftime("%Y%m%d"),
            "posNo": pos_no,
            "saleFg": sale_fg,
            "CHK_ID": easypos_id,
        }
        resp = self._ssv_post("/sle014/selectSalePerDayList.do", params)
        rows = resp.datasets.get("dsOutSalePerDayList") or []
        total = sum(int(r.get("총매출") or 0) for r in rows)
        return DailySalesResult(
            sale_date=sale_date,
            receipts=rows,
            total_sales=total,
            receipt_count=len(rows),
        )

    def fetch_dashboard(self, easypos_id: str) -> dict:
        """대시보드 — 월별/주간/항목별 매출 요약."""
        params = {
            "easyposid": easypos_id,
            "EMP_AUTH": "1",
            "CHK_ID": easypos_id,
        }
        resp = self._ssv_post("/cmDashBoard/selectDashBoard.do", params)
        return {
            "month_target": resp.datasets.get("dsOutSalesMonthTarget", []),
            "week_sales":   resp.datasets.get("dsOutWeekSales", []),
            "compare":      resp.datasets.get("dsOutSalesCompare", []),
            "compare_chart": resp.datasets.get("dsOutSalesCompareChart", []),
            "shop_cnt":     resp.first("dsOutShopCnt") or {},
        }

    def fetch_shop_pos_list(self, easypos_id: str) -> list[dict]:
        """매장 내 POS 단말 목록."""
        params = {
            "easyposid": easypos_id,
            "shopName": "",
            "shopNo": "",
            "CHK_ID": easypos_id,
        }
        resp = self._ssv_post("/cmCond/selectShopPosList.do", params)
        return resp.datasets.get("dsShopPos") or []


# ──────────────────────────────────────────────────────────────────
# 비즈니스 로직 — DB 적재
# ──────────────────────────────────────────────────────────────────

def _to_int(v) -> int:
    if v is None or v == "":
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0


def upsert_daily_receipts(session, business_id: int, result: DailySalesResult) -> dict:
    """fetch_daily_sales 결과를 EasyPosSaleReceipt 에 upsert.

    (business_id, sale_date, pos_no, receipt_no) 중복 시 update.
    """
    from sqlmodel import select
    from models import EasyPosSaleReceipt

    inserted = 0
    updated = 0
    skipped = 0

    for row in result.receipts:
        biz_date_str = (row.get("영업일자") or "").strip()
        pos_no = (row.get("POS번호") or "").strip()
        receipt_no = (row.get("영수증번호") or "").strip()
        if not biz_date_str or not pos_no or not receipt_no:
            skipped += 1
            continue
        try:
            sale_date = datetime.datetime.strptime(biz_date_str, "%Y%m%d").date()
        except ValueError:
            skipped += 1
            continue

        existing = session.exec(
            select(EasyPosSaleReceipt).where(
                EasyPosSaleReceipt.business_id == business_id,
                EasyPosSaleReceipt.sale_date == sale_date,
                EasyPosSaleReceipt.pos_no == pos_no,
                EasyPosSaleReceipt.receipt_no == receipt_no,
            )
        ).first()

        fields = dict(
            business_id=business_id,
            sale_date=sale_date,
            pos_no=pos_no,
            receipt_no=receipt_no,
            sale_time=(row.get("매출시간") or None),
            payment_time=(row.get("결제시간") or None),
            sale_flag=(row.get("매출구분") or None),
            total_amount=_to_int(row.get("총매출")),
            net_amount=_to_int(row.get("순매출")),
            net_sales=_to_int(row.get("NET매출")),
            vat=_to_int(row.get("부가세")),
            service_charge=_to_int(row.get("봉사료")),
            discount=_to_int(row.get("할인")),
            customer_count=_to_int(row.get("고객수")),
            cash_amount=_to_int(row.get("현금매출")),
            card_amount=_to_int(row.get("카드매출")),
            point_amount=_to_int(row.get("포인트매출")),
            voucher_amount=_to_int(row.get("상품권매출")),
            cashback_amount=_to_int(row.get("캐쉬백매출")),
            prepaid_card_amount=_to_int(row.get("선불카드매출")),
            credit_amount=_to_int(row.get("외상매출")),
            exchange_voucher_amount=_to_int(row.get("교환권매출")),
            employee_card_amount=_to_int(row.get("직원카드매출")),
            e_money_amount=_to_int(row.get("전자화폐매출")),
            sale_type=(row.get("판매형태") or None),
            synced_at=datetime.datetime.utcnow(),
        )
        # raw JSON 보존 (모든 필드 직렬화)
        try:
            fields["raw_json"] = json.dumps(
                {k: (str(v) if v is not None else None) for k, v in row.items()
                 if k != "_rowType"},
                ensure_ascii=False,
            )
        except (TypeError, ValueError):
            fields["raw_json"] = None

        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
            updated += 1
        else:
            session.add(EasyPosSaleReceipt(**fields))
            inserted += 1

    session.commit()
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "total_processed": inserted + updated,
    }


def upsert_revenue_aggregate(session, business_id: int, sale_date: datetime.date) -> int:
    """일자 영수증 집계 → Revenue(channel='Store') upsert.

    이지포스 raw 영수증을 sum 해서 매장 매출 1건으로 저장.
    Revenue.amount 는 **순매출** (부가세 제외) — 매출분석/손익에서 일관성.
    """
    from sqlmodel import select
    from models import EasyPosSaleReceipt, Revenue

    rows = session.exec(
        select(EasyPosSaleReceipt).where(
            EasyPosSaleReceipt.business_id == business_id,
            EasyPosSaleReceipt.sale_date == sale_date,
        )
    ).all()

    total_net = sum(int(r.net_amount or 0) for r in rows)
    receipt_count = len(rows)

    if receipt_count == 0:
        return 0

    rev = session.exec(
        select(Revenue).where(
            Revenue.business_id == business_id,
            Revenue.date == sale_date,
            Revenue.channel == "Store",
        )
    ).first()
    description = f"이지포스 자동수집 (영수 {receipt_count}건)"
    if rev:
        rev.amount = total_net
        rev.description = description
        session.add(rev)
    else:
        rev = Revenue(
            business_id=business_id,
            date=sale_date,
            channel="Store",
            amount=total_net,
            description=description,
        )
        session.add(rev)
    session.commit()
    return total_net
