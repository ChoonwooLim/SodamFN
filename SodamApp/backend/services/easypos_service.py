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

import binascii
import datetime
import json
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx
from cryptography.hazmat.primitives.asymmetric import padding as rsa_padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers

from services.nexacro_ssv import build_ssv_request, parse_ssv, SsvResponse


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
    warning_message: Optional[str] = None  # 인증 성공이지만 정책 경고 (예: 비번 만료)


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
        self._warmed_up = False

    def _warmup_session(self) -> None:
        """index.jsp GET 으로 JSESSIONID 발급 — 모든 XHR 호출 전 필수.

        이지포스 백엔드는 Spring/JSP 기반이라 JSESSIONID 가 없으면 RSA 키쌍
        매칭이 안 된다. 한 인스턴스당 1회만.
        """
        if self._warmed_up:
            return
        try:
            r = self._client.get("/index.jsp")
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise EasyPosError(f"세션 발급 통신 실패: {e}") from e
        self._warmed_up = True

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
                  *, datasets: Optional[dict] = None,
                  in_secure: int = 1, out_secure: int = 1) -> SsvResponse:
        """SSV 형식 POST. 응답도 SSV.

        HAR 분석 기준 헤더 — Content-Type: text/xml, Accept: application/xml,
        X-Requested-With: XMLHttpRequest 가 필수. (이지포스가 XHR 만 허용)

        보안모드 파라미터:
          - in_secure=1  : 요청 body 의 일부 필드(USER_ID/USER_PW) 가 클라이언트단
                          암호화 (이지포스 JS 가 SEED/AES 로 처리) — 평문 보내면 실패
          - in_secure=0  : 평문 전송 시도 (서버가 받아주는지 불확실 — 테스트 필요)
          - out_secure=0 : 응답을 평문 SSV 로 받음 (기본 1 도 보통 평문 응답)

        로그인은 in_secure=0 시도 → 실패 시 in_secure=1 + 자체 암호화 구현 필요.
        매출 조회 등은 ID/PW 가 body 에 안 들어가서 보안모드 무관.
        """
        # XHR 호출 전 세션 warm-up 필수 — JSESSIONID 없으면 RSA 키쌍 매칭 실패
        self._warmup_session()

        body = build_ssv_request(params, datasets=datasets)
        url = f"{path}?inSecureMode={in_secure}&outSecureMode={out_secure}"
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

    def _fetch_public_key(self) -> tuple[str, str]:
        """이지포스 로그인용 RSA 공개키 발급.

        POST /cm/checkLoginStatus.do — 응답 ErrorMsg 가 "<modulus_hex> <exponent_hex>"
        형식. JS 의 FRM_LOGINMAIN.xfdl.js callBack 에서 ErrorMsg.split(" ") 으로
        분해하는 그대로 재현. 동일 httpx.Client 세션을 쓰므로 이후 로그인 호출과
        쿠키 공유.

        Returns:
            (modulus_hex, exponent_hex)
        """
        # dsIn Dataset 1줄 — JS 가 LOGINSTATUS/LOGINSTATUS/0 으로 sentinel 전달
        datasets = {
            "dsIn": {
                "columns": ["USER_ID:STRING(256)", "USER_PW:STRING(256)",
                            "ADMIN_FG:STRING(256)"],
                "rows": [("N", ["LOGINSTATUS", "LOGINSTATUS", "0"])],
            }
        }
        params = {"CHK_ID": ""}
        # 보안모드 무관 — 응답 ErrorMsg 에 공개키 hex 가 그대로 옴
        url = "/cm/checkLoginStatus.do?inSecureMode=1&outSecureMode=1"
        body = build_ssv_request(params, datasets=datasets)
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
                },
            )
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise EasyPosError(f"공개키 발급 통신 실패: {e}") from e

        resp = parse_ssv(r.text)
        # ErrorCode=0000 이 정상 — parse_ssv 는 "0" 만 정상으로 본다.
        # 그래서 ok 검사 우회: ErrorMsg 형식만 확인.
        msg = (resp.error_msg or "").strip()
        parts = msg.split(" ")
        if len(parts) != 2 or len(parts[0]) < 32:
            raise EasyPosError(
                f"공개키 형식 오류 — ErrorCode={resp.error_code} ErrorMsg={msg[:120]}"
            )
        return parts[0], parts[1]

    def _rsa_encrypt(self, plain: str, modulus_hex: str, exponent_hex: str) -> str:
        """이지포스 JSON RSAKey 라이브러리와 호환되는 RSA-PKCS1v1.5 암호화.

        JS RSAKey (jsbn 기반) 표준: PKCS#1 v1.5 padding.
        Returns: hex 인코딩된 ciphertext (modulus 크기 × 2 chars).
        """
        n = int(modulus_hex, 16)
        e = int(exponent_hex, 16)
        pub = RSAPublicNumbers(e=e, n=n).public_key()
        ciphertext = pub.encrypt(plain.encode("utf-8"), rsa_padding.PKCS1v15())
        return binascii.hexlify(ciphertext).decode("ascii")

    def login(self, easypos_id: str, password: str) -> LoginResult:
        """이지포스 로그인 — RSA 공개키 발급 → ID/PW 암호화 → selectEasyPosLogin.do.

        흐름 (이지포스 JS FRM_LOGINMAIN.xfdl.js 재현):
          0) GET /index.jsp — JSESSIONID 세션 쿠키 발급 (warm-up)
          1) POST /cm/checkLoginStatus.do  → 공개키(modulus, exponent) hex
          2) USER_ID, USER_PW 를 RSA-PKCS1v15 로 암호화 → 64 byte hex 문자열
          3) POST /cm/selectEasyPosLogin.do — 암호화된 dsIn Dataset 전송

        Soft warning ErrorCode:
          - 5636: "현재 비밀번호는 정책에 맞지 않습니다. 변경하십시오."
                  세션 인증은 성공 — 매장 정보 정상 응답. warning_message 로 노출.
        """
        try:
            self._warmup_session()
            modulus_hex, exponent_hex = self._fetch_public_key()
            secured_id = self._rsa_encrypt(easypos_id, modulus_hex, exponent_hex)
            secured_pw = self._rsa_encrypt(password, modulus_hex, exponent_hex)
        except EasyPosError as e:
            return LoginResult(ok=False, error_message=str(e))
        except Exception as e:  # noqa: BLE001
            return LoginResult(
                ok=False,
                error_message=f"RSA 암호화 실패: {e}",
            )

        datasets = {
            "dsIn": {
                "columns": ["USER_ID:STRING(256)", "USER_PW:STRING(256)",
                            "ADMIN_FG:STRING(256)"],
                "rows": [("N", [secured_id, secured_pw, "0"])],
            }
        }
        params = {
            "easyposid": easypos_id,
            "adminId": "undefined",
            "adminPw": "undefined",
            "contents": "undefined",
            "CHK_ID": "",
        }

        # 5636(비번 만료) 은 매장 정보가 응답에 채워지는 soft warning — 직접 호출 후
        # 응답 파싱 시 분기 처리.
        url = "/cm/selectEasyPosLogin.do?inSecureMode=1&outSecureMode=1"
        body = build_ssv_request(params, datasets=datasets)
        try:
            r = self._client.post(
                url, content=body.encode("utf-8"),
                headers={
                    "Content-Type": "text/xml",
                    "Accept": "application/xml, text/xml, */*",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": self.base_url,
                    "Referer": f"{self.base_url}/easyposnx/index.html",
                },
            )
            r.raise_for_status()
        except httpx.HTTPError as e:
            return LoginResult(ok=False, error_message=f"이지포스 통신 실패: {e}")

        resp = parse_ssv(r.text)
        info = resp.first("gdsLoginInfo") or {}
        has_shop = bool(info.get("SHOP_NAME") or info.get("USER_ID"))

        # 매장 정보 응답에 있으면 인증 자체는 통과. 5636 등은 warning 으로 노출.
        if has_shop:
            warning = None
            if resp.error_code not in ("0", "0000", ""):
                warning = f"[{resp.error_code}] {resp.error_msg}"
            self._logged_in = True
            self._easypos_id = easypos_id
            return LoginResult(
                ok=True,
                shop_name=info.get("SHOP_NAME"),
                erp_shop_code=info.get("ERP_SHOP_CODE"),
                head_office_no=info.get("HEAD_OFFICE_NO"),
                user_name=info.get("USER_NM"),
                raw_login_info=info,
                warning_message=warning,
            )

        # 매장 정보 없음 — 실제 인증 실패
        return LoginResult(
            ok=False,
            error_message=f"이지포스 로그인 실패: [{resp.error_code}] {resp.error_msg or 'ID/PW 확인 필요'}",
        )

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

    def fetch_card_sales(self, easypos_id: str,
                         start_date: datetime.date, end_date: datetime.date,
                         shop_no: str = "", pos_no: str = "") -> dict:
        """카드사별 매출내역 조회 (sle205/selectCardSaleList.do).

        영수증 단(/sle014/selectSalePerDayList.do) 은 카드매출을 단일 통합
        합계로만 제공. 카드사별 분해를 위해 이 endpoint 호출 추가.

        Args:
            easypos_id: 가맹점 로그인 ID (보통 사업자번호)
            start_date / end_date: 조회 기간 (영업일자 기준)
            shop_no: 특정 매장 (멀티매장), 빈값=전체
            pos_no: 특정 POS, 빈값=전체

        Returns:
            {"rows": [...], "total_amount": int, "row_count": int}

        Request SSV params (사장님 실 호출 검증 2026-05-13):
            easyposid / shopNo / fromDate / toDate / apprNo / cardNo
            / srchFg / cardCode / CHK_ID

        Response dataset: dsOutCardSaleList. 컬럼 (한글):
            영업일자, 매장코드, 포스번호, 영수증번호, 거래일자, 거래시간,
            승인구분 (항상 "POS승인"), 승인번호, 카드번호 (마스킹),
            카드사 (발급사), 매입사 (acquirer/정산사), 승인금액, 할부개월수,
            매출구분 (승인/취소), 유효기간, 사업자코드, 봉사료, 부가세,
            보증금액, 메세지, 비고.
        """
        params = {
            "easyposid": easypos_id,
            "shopNo": shop_no,
            "fromDate": start_date.strftime("%Y%m%d"),
            "toDate": end_date.strftime("%Y%m%d"),
            "apprNo": "",          # 승인번호 검색 (빈값=전체)
            "cardNo": "",          # 카드번호 검색 (빈값=전체)
            "srchFg": "",          # 검색구분 (빈값=전체)
            "cardCode": "",        # 카드사 코드 (빈값=전체)
            "CHK_ID": easypos_id,
        }
        resp = self._ssv_post("/sle205/selectCardSaleList.do", params)
        rows = resp.datasets.get("dsOutCardSaleList") or []
        total = sum(
            _to_int(r.get("승인금액") or r.get("amount") or 0)
            for r in rows
        )
        return {
            "rows": rows,
            "total_amount": total,
            "row_count": len(rows),
        }

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
    """일자 영수증 집계 → Revenue(channel='매장') upsert.

    이지포스 raw 영수증을 sum 해서 매장 매출 1건으로 저장.
    Revenue.amount 는 **순매출** (부가세 제외) — 매출분석/손익에서 일관성.
    """
    from sqlmodel import select
    from models import EasyPosSaleReceipt, Revenue
    from constants import REVENUE_CHANNEL_STORE

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
            Revenue.channel == REVENUE_CHANNEL_STORE,
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
            channel=REVENUE_CHANNEL_STORE,
            amount=total_net,
            description=description,
        )
        session.add(rev)
    session.commit()
    return total_net


# ──────────────────────────────────────────────────────────────────
# 카드사별 매출 — CardSalesApproval 적재
# ──────────────────────────────────────────────────────────────────

# 카드사명 표준화 — CODEF 카드 동기화와 동일 식별자 사용
_CARD_CORP_NORMALIZE = {
    "KB국민카드": "KB국민",
    "국민카드": "KB국민",
    "신한카드": "신한",
    "삼성카드": "삼성",
    "비씨카드": "BC",
    "BC카드": "BC",
    "롯데카드": "롯데",
    "현대카드": "현대",
    "하나카드": "하나",
    "하나SK카드": "하나",
    "하나구외환": "하나",
    "우리카드": "우리",
    "NH농협카드": "NH농협",
    "농협카드": "NH농협",
    "NH카드": "NH농협",        # EasyPOS 매입사 표기
    "씨티카드": "씨티",
    "한국씨티카드": "씨티",
}


def _normalize_card_corp(raw: str) -> str:
    """카드사명 표준화 — 매칭 안 되면 원본 그대로.

    매출/입금 양쪽에서 같은 식별자를 써야 정산 매칭이 가능.
    """
    if not raw:
        return ""
    s = raw.strip()
    if s in _CARD_CORP_NORMALIZE:
        return _CARD_CORP_NORMALIZE[s]
    # 부분 매칭 — '카드' 접미사 제거 후 표준화된 값 중에 있으면 그걸 사용
    if s.endswith("카드"):
        base = s[:-2]
        if base in _CARD_CORP_NORMALIZE.values():
            return base
    return s


def upsert_card_sales(session, business_id: int, result: dict) -> dict:
    """fetch_card_sales 결과를 CardSalesApproval 에 upsert.

    중복 키: (business_id, approval_date, approval_number, card_corp).
    source='easypos' 로 마킹 → 후일 CODEF/엑셀 출처와 구분 가능.

    Returns:
        {"inserted": N, "updated": N, "skipped": N, "total_processed": N}
    """
    from sqlmodel import select
    from models import CardSalesApproval

    inserted = 0
    updated = 0
    skipped = 0

    for row in result["rows"]:
        # 영업일자 우선, 없으면 거래일자
        biz_date_str = (row.get("영업일자") or row.get("거래일자") or "").strip()
        approval_no = (row.get("승인번호") or "").strip()
        # 카드사 = 발급사 (issuer), 매입사 = 정산사 (acquirer).
        # 사장님 정산/P/L 은 매입사 기준 (CODEF 카드 명세도 매입사 기준)이라 매입사 우선.
        # 매입사 비어있을 때만 카드사 fallback.
        acquirer_raw = (row.get("매입사") or "").strip()
        issuer_raw = (row.get("카드사") or "").strip()
        card_corp_raw = acquirer_raw or issuer_raw
        if not biz_date_str or not approval_no:
            skipped += 1
            continue
        try:
            approval_date = datetime.datetime.strptime(biz_date_str, "%Y%m%d").date()
        except ValueError:
            skipped += 1
            continue

        # 카드사명 표준화: "KB국민카드" → "KB국민", "비씨카드" → "BC" 등
        card_corp = _normalize_card_corp(card_corp_raw)

        existing = session.exec(
            select(CardSalesApproval).where(
                CardSalesApproval.business_id == business_id,
                CardSalesApproval.approval_date == approval_date,
                CardSalesApproval.approval_number == approval_no,
                CardSalesApproval.card_corp == card_corp,
            )
        ).first()

        amount = _to_int(row.get("승인금액"))
        # 매출구분 = "승인" / "취소". 승인구분("POS승인") 은 채널이라 status 와 무관.
        sale_type_raw = (row.get("매출구분") or "").strip()
        status = "취소" if "취소" in sale_type_raw else "승인"

        fields = dict(
            business_id=business_id,
            approval_date=approval_date,
            approval_time=(row.get("거래시간") or None),
            card_corp=card_corp,
            card_number=(row.get("카드번호") or None),
            approval_number=approval_no,
            amount=amount,
            installment=(row.get("할부개월수") or None),
            status=status,
            shop_name=(issuer_raw or None),  # 발급사명 (정산은 card_corp=매입사로)
            source="easypos",
            source_meta=None,
            synced_at=datetime.datetime.utcnow(),
        )

        if existing:
            for k, v in fields.items():
                # None 값은 기존 데이터를 덮어쓰지 않음. amount/status 는 항상 갱신.
                if v is not None or k in ("amount", "status"):
                    setattr(existing, k, v)
            session.add(existing)
            updated += 1
        else:
            session.add(CardSalesApproval(**fields))
            inserted += 1

    session.commit()
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "total_processed": inserted + updated,
    }
