"""connectedId 라이프사이클 관리.

등록 / 재인증 / 해제 / 조회 + DB 동기화.
인증 페이로드를 받아 RSA 암호화 → CodefClient.create_account → DB 저장.

추가본인확인 발생 시 CodefAdditionalAuth 예외를 그대로 라우터로 전파 →
라우터가 SMS 코드 입력 폼을 띄움.

간편인증 (카카오/네이버/PASS) 은 2-step 흐름:
  1) start_simple_auth → 사장님 모바일에 본인인증 요청 발송 + PendingCodefAuth 저장
  2) (사장님 본인인증 완료 후) complete_simple_auth → twoWayInfo 첨부 재호출
"""
import datetime
import json
import re
from typing import Optional

from sqlmodel import Session, select

from models import CodefConnection, Business, PendingCodefAuth
from .codef_client import CodefClient
from .organization_catalog import get_organization, AuthPolicy


class CodefConnectionService:
    def __init__(self, engine, client: Optional[CodefClient] = None):
        self.engine = engine
        self._client = client or CodefClient()

    # ─── 등록 / 재인증 / 해제 ───────────────────────

    def register_card(self, business_id: int, card_corp_code: str,
                      auth_payload: dict,
                      connection_type: str = "card_sales") -> CodefConnection:
        """auth_payload 형식:
        - ID/PW:    {"id": "...", "password": "..."}
        - 간편인증: {"identity": "...", "loginType": "kakao", "birthDate": "...", ...}

        사업자 카드 인증은 사업자등록번호(businessRegNo)도 페이로드에 포함 —
        Business 모델에서 자동 추출.

        connection_type:
          - 'card_sales'   : 사업자 가맹점 매출 (사업자 카드사 사이트 ID/PW)
          - 'card_purchase': 사장님 카드 사용내역(매입) — 개인 카드 사이트 ID/PW
        """
        if connection_type not in {"card_sales", "card_purchase"}:
            raise ValueError(f"잘못된 connection_type: {connection_type}")

        org = get_organization(card_corp_code)
        if not org or org.type != "card":
            raise ValueError(f"알 수 없는 카드사: {card_corp_code}")

        biz_reg_no = self._get_business_reg_no(business_id)
        sdk_payload, auth_method = self._build_account_payload(org, auth_payload, biz_reg_no)
        result = self._client.create_account(sdk_payload)

        # 카드비번은 connectedId 등록 페이로드와 분리 보관 —
        # 매뉴얼상 등록 단계에는 ID/PW 만 전송. 카드비번은 조회 API 호출 시
        # ``cardPassword`` 파라미터로 전달 (현대카드 등 일부 카드사 필수).
        card_pw_encrypted = None
        raw_card_pw = auth_payload.get("cardPassword")
        if raw_card_pw:
            card_pw_encrypted = self._client.encrypt_password(str(raw_card_pw))

        return self._upsert_connection(
            business_id=business_id,
            organization=org,
            connected_id=result.connected_id,
            auth_method=auth_method,
            connection_type=connection_type,
            card_password_encrypted=card_pw_encrypted,
        )

    # ─── 간편인증 2-step 흐름 ────────────────────────

    SIMPLE_AUTH_LOGIN_TYPES = {"kakao", "naver", "pass", "toss", "payco", "samsung"}

    def start_simple_auth(self, business_id: int, card_corp_code: str,
                          auth_payload: dict,
                          connection_type: str = "card_purchase") -> dict:
        """간편인증 1단계 — 카카오/네이버 본인인증 요청 발송.

        Args:
            business_id: 대상 사업장 id.
            card_corp_code: 카드사 코드 (organization_catalog).
            auth_payload: {
                "loginType": "kakao"|"naver"|"pass"|"toss"|"payco"|"samsung",
                "userName": "홍길동",
                "phoneNo": "01071391796",
                "birthDate": "19800101",  # YYYYMMDD
                "telecom": "0",            # 0=SKT, 1=KT, 2=LG U+, 3=알뜰
                # 선택: "client_type": "P"|"B"
            }
            connection_type: 'card_sales' | 'card_purchase'.

        Returns:
            {
              "status": "additional_auth_required",
              "method": "simple_kakao" 등,
              "auth_pending_id": int,
              "extra_info": dict,           # CODEF 가 응답한 extraInfo (모바일 인증 안내)
              "expires_at": isoformat str,
            }

        Raises:
            ValueError: organization 미지원 / loginType 미지원 / connection_type 잘못됨.
            CodefAPIError: CODEF 측 명확한 실패.
        """
        if connection_type not in {"card_sales", "card_purchase"}:
            raise ValueError(f"잘못된 connection_type: {connection_type}")

        org = get_organization(card_corp_code)
        if not org or org.type != "card":
            raise ValueError(f"알 수 없는 카드사: {card_corp_code}")

        login_type = (auth_payload.get("loginType") or "").lower()
        if login_type not in self.SIMPLE_AUTH_LOGIN_TYPES:
            raise ValueError(
                f"간편인증 미지원 loginType: {login_type} "
                f"(허용: {sorted(self.SIMPLE_AUTH_LOGIN_TYPES)})"
            )

        biz_reg_no = self._get_business_reg_no(business_id)
        sdk_payload, _ = self._build_account_payload(org, auth_payload, biz_reg_no)
        auth_method = f"simple_{login_type}"

        # SDK 첫 호출 — CF-03002 / CF-03012 응답 기대
        response = self._client.create_account_raw(sdk_payload)
        result = response.get("result", {}) or {}
        code = result.get("code", "")
        if code not in {"CF-03002", "CF-03012", "CF-03013"}:
            # 추가인증 응답이 아닌데도 도달했다면 비정상 — 메시지로 에러
            from .exceptions import CodefAPIError
            raise CodefAPIError(
                code=code or "unexpected",
                message=(
                    f"간편인증 1단계 응답이 추가인증 코드가 아님: "
                    f"{result.get('message', '')} {result.get('extraMessage', '')}"
                ).strip(),
                raw=response,
            )

        # SDK 표준 — data 최상단에 twoWayInfo 필수 4 키가 들어옴.
        # extraInfo 는 사장님 모바일 안내용 (인증요청 메시지 등) — 분리 보관.
        data = response.get("data") or {}
        required_two_way_keys = ("jobIndex", "threadIndex", "jti", "twoWayTimestamp")
        if not all(k in data for k in required_two_way_keys):
            from .exceptions import CodefAPIError
            raise CodefAPIError(
                code=code,
                message=(
                    f"간편인증 응답에 twoWayInfo 필수 필드 누락 "
                    f"(jobIndex/threadIndex/jti/twoWayTimestamp). "
                    f"받은 키: {list(data.keys())}"
                ),
                raw=response,
            )

        two_way_info = {
            "jobIndex": int(data["jobIndex"]),
            "threadIndex": int(data["threadIndex"]),
            "twoWayTimestamp": int(data["twoWayTimestamp"]),
            "jti": data["jti"],
        }

        # 사장님 모바일 안내용 부가 정보 (인증요청 메시지 등)
        extra_info = data.get("extraInfo") or {}
        if not extra_info:
            extra_info = data

        now = datetime.datetime.utcnow()
        expires_at = now + datetime.timedelta(minutes=2)

        with Session(self.engine) as s:
            pending = PendingCodefAuth(
                business_id=business_id,
                organization_code=card_corp_code,
                connection_type=connection_type,
                auth_method=auth_method,
                payload_json=json.dumps(sdk_payload, ensure_ascii=False),
                # extra_info_json 에 SDK 호출용 twoWayInfo 4 키 + UI 안내용 extraInfo 분리 보관.
                extra_info_json=json.dumps(
                    {"twoWayInfo": two_way_info, "extraInfo": extra_info},
                    ensure_ascii=False,
                ),
                created_at=now,
                expires_at=expires_at,
            )
            s.add(pending)
            s.commit()
            s.refresh(pending)
            pending_id = pending.id

        return {
            "status": "additional_auth_required",
            "method": auth_method,
            "auth_pending_id": pending_id,
            "extra_info": extra_info,
            "expires_at": expires_at.isoformat(),
        }

    def complete_simple_auth(self, auth_pending_id: int) -> CodefConnection:
        """간편인증 2단계 — 사장님 모바일 본인인증 완료 후 호출.

        SDK 표준 (``easycodefpy.py`` line 50-72, 152-166):
          * ``is2Way`` 는 Python ``bool`` 타입 (string "true" 금지 — SDK
            ``_has_two_way_keyword`` 에서 line 63 ``type(is_2way) != bool`` 체크).
          * ``twoWayInfo`` 는 ``dict`` 이며 ``jobIndex / threadIndex / jti /
            twoWayTimestamp`` 4 키 모두 존재 (line 50-57 검증).
          * 둘 다 SDK 페이로드 최상단(param level) 에 첨부 — accountList[0] 내부 X.
          * SDK ``create_account`` 가 아닌 ``request_certification`` 으로 호출
            (PATH = ``/v1/account/create``).
        """
        with Session(self.engine) as s:
            pending = s.get(PendingCodefAuth, auth_pending_id)
            if not pending:
                raise ValueError(f"pending auth {auth_pending_id} 없음")
            if pending.expires_at and pending.expires_at < datetime.datetime.utcnow():
                # 만료된 pending 은 삭제 + 명확한 에러
                s.delete(pending)
                s.commit()
                raise ValueError("간편인증 만료. 처음부터 다시 시도해주세요.")
            sdk_payload = json.loads(pending.payload_json)
            extra_info_blob = json.loads(pending.extra_info_json or "{}")
            business_id = pending.business_id
            card_corp_code = pending.organization_code
            connection_type = pending.connection_type
            auth_method = pending.auth_method

        # extra_info_json 에는 1단계에서 추출한 twoWayInfo 4 키가 보관돼 있어야 함.
        # (구 포맷 호환: 최상단에 jobIndex 등이 직접 있는 경우 그대로 사용.)
        two_way_info = extra_info_blob.get("twoWayInfo")
        if not two_way_info or not isinstance(two_way_info, dict):
            # 구 포맷 fallback — 자체가 twoWayInfo 일 수도 (저장 직전 호환)
            if all(k in extra_info_blob for k in
                   ("jobIndex", "threadIndex", "jti", "twoWayTimestamp")):
                two_way_info = {
                    "jobIndex": int(extra_info_blob["jobIndex"]),
                    "threadIndex": int(extra_info_blob["threadIndex"]),
                    "twoWayTimestamp": int(extra_info_blob["twoWayTimestamp"]),
                    "jti": extra_info_blob["jti"],
                }
            else:
                from .exceptions import CodefAPIError
                raise CodefAPIError(
                    code="missing_two_way_info",
                    message="pending 에 twoWayInfo 4 키가 없음 — 1단계부터 다시 시도",
                    raw=extra_info_blob,
                )

        # ⚠ SDK 표준: param level (accountList[0] 내부 X). bool (string X).
        sdk_payload["twoWayInfo"] = two_way_info
        sdk_payload["is2Way"] = True

        # ⚠ create_account 가 아닌 request_certification — PATH 는 /v1/account/create.
        PATH_CREATE_ACCOUNT = "/v1/account/create"
        result = self._client.request_certification_raw(PATH_CREATE_ACCOUNT, sdk_payload)

        response_result = result.get("result", {}) or {}
        response_code = response_result.get("code", "")
        if response_code != "CF-00000":
            from .exceptions import CodefAPIError
            full_msg = (
                f"{response_result.get('message', '')} "
                f"{response_result.get('extraMessage', '')}"
            ).strip()
            raise CodefAPIError(
                code=response_code or "unknown",
                message=f"간편인증 2단계 실패: {full_msg}",
                raw=result,
            )

        connected_id = (result.get("data") or {}).get("connectedId", "")
        if not connected_id:
            from .exceptions import CodefAPIError
            raise CodefAPIError(
                code="missing_connected_id",
                message=f"간편인증 2단계 응답에 connectedId 없음 — raw: {str(result)[:500]}",
                raw=result,
            )

        org = get_organization(card_corp_code)
        conn = self._upsert_connection(
            business_id=business_id,
            organization=org,
            connected_id=connected_id,
            auth_method=auth_method,
            connection_type=connection_type,
        )

        # pending 정리 (성공 시)
        with Session(self.engine) as s:
            pending = s.get(PendingCodefAuth, auth_pending_id)
            if pending:
                s.delete(pending)
                s.commit()
        return conn

    def register_bank(self, business_id: int, bank_code: str,
                      auth_payload: dict) -> CodefConnection:
        """은행 connectedId 발급 + CodefConnection 저장. 3가지 인증 방식 지원.

        auth_payload 형식:
          ID/PW:       {"id", "password", "client_type"}
          공동인증서:  {"certFile" (b64), "keyFile" (b64), "certPwd", "client_type"}
          간편인증:    {"loginType": "kakao"|"naver"|"pass"|"toss"|"payco"|"samsung",
                       "userName", "phoneNo", "birthDate" or "identity", "client_type"}
        """
        org = get_organization(bank_code)
        if not org or org.type != "bank":
            raise ValueError(f"알 수 없는 은행: {bank_code}")

        biz_reg_no = self._get_business_reg_no(business_id)
        sdk_payload, auth_method = self._build_bank_payload(org, auth_payload, biz_reg_no)
        result = self._client.create_account(sdk_payload)
        return self._upsert_connection(
            business_id=business_id,
            organization=org,
            connected_id=result.connected_id,
            auth_method=auth_method,
            connection_type="bank",
        )

    def _build_bank_payload(self, org, auth_payload: dict, biz_reg_no: str) -> tuple[dict, str]:
        """은행 인증 페이로드 빌드. auth_payload 형식 자동 감지."""
        client_type = (auth_payload.get("client_type") or "B").upper()
        if client_type not in {"P", "B"}:
            client_type = "B"

        base = {
            "countryCode": "KR",
            "businessType": "BK",
            "clientType": client_type,
            "organization": org.code,
        }
        if client_type == "B" and biz_reg_no:
            base["businessRegNo"] = biz_reg_no

        # 1) 공동인증서
        if "certFile" in auth_payload and "keyFile" in auth_payload:
            cert_pwd = auth_payload.get("certPwd") or auth_payload.get("cert_pwd") or ""
            account = {
                **base,
                "loginType": "0",          # 0 = 공동인증서
                "certType": "1",
                "certFile": auth_payload["certFile"],
                "keyFile": auth_payload["keyFile"],
                "certPassword": self._client.encrypt_password(cert_pwd) if cert_pwd else "",
            }
            return {"accountList": [account]}, "cert"

        # 2) 간편인증
        simple_types = {"kakao", "naver", "pass", "toss", "payco", "samsung"}
        login_type = (auth_payload.get("loginType") or "").lower()
        if login_type in simple_types:
            account = {
                **base,
                "loginType": "5",          # 5 = 간편인증
                "loginTypeLevel": "1",
                "loginIdentity": login_type,
                "userName": auth_payload.get("userName", ""),
                "phoneNo": auth_payload.get("phoneNo", "") or auth_payload.get("phone", ""),
                "birthDate": auth_payload.get("birthDate", "") or auth_payload.get("identity", ""),
                "telecom": auth_payload.get("telecom", "0"),
                "isIdentify": "1",
                "is2Way": "true",
            }
            return {"accountList": [account]}, f"simple_{login_type}"

        # 3) ID/PW (기본)
        if "id" in auth_payload and "password" in auth_payload:
            encrypted = self._client.encrypt_password(auth_payload["password"])
            account = {
                **base,
                "loginType": "1",          # 1 = ID/PW
                "id": auth_payload["id"],
                "password": encrypted,
            }
            return {"accountList": [account]}, "id_pw"

        raise ValueError(
            "지원 안 되는 auth_payload 형식. id/password 또는 certFile/keyFile "
            "또는 loginType(kakao/naver/pass/toss/payco/samsung) 중 하나 필요"
        )

    def _get_business_reg_no(self, business_id: int) -> str:
        """Business.business_number 에서 하이픈 제거한 10자리 추출."""
        with Session(self.engine) as s:
            biz = s.get(Business, business_id)
            if not biz or not biz.business_number:
                return ""
            return re.sub(r"[^0-9]", "", biz.business_number)

    def reverify(self, connection_id: int, auth_payload: dict) -> CodefConnection:
        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            if not conn:
                raise ValueError(f"connection {connection_id} 없음")
            org = get_organization(conn.organization_code)
            if not org:
                raise ValueError(f"알 수 없는 organization_code: {conn.organization_code}")
            target_business_id = conn.business_id

        biz_reg_no = self._get_business_reg_no(target_business_id)
        sdk_payload, auth_method = self._build_account_payload(org, auth_payload, biz_reg_no)
        result = self._client.create_account(sdk_payload)

        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            conn.connected_id = result.connected_id
            conn.auth_method = auth_method
            conn.status = "active"
            conn.last_verified_at = datetime.datetime.utcnow()
            conn.last_failed_at = None
            conn.last_error_code = None
            conn.last_error_message = None
            s.add(conn)
            s.commit()
            s.refresh(conn)
            return conn

    def deactivate(self, connection_id: int) -> None:
        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            if not conn:
                raise ValueError(f"connection {connection_id} 없음")
            conn.status = "deactivated"
            conn.deactivated_at = datetime.datetime.utcnow()
            s.add(conn)
            s.commit()

    def mark_failed(self, connection_id: int, status: str,
                    error_code: str = "", error_message: str = "") -> None:
        """카드 동기화 실패 시 connection 상태 갱신.

        status: 'expired' | 'failed_2fa' | 'paused'
        """
        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            if not conn:
                return
            conn.status = status
            conn.last_failed_at = datetime.datetime.utcnow()
            conn.last_error_code = error_code
            conn.last_error_message = error_message
            s.add(conn)
            s.commit()

    # ─── 조회 ───────────────────────────────────────

    def list_active(self, business_id: int, organization_type: str) -> list[CodefConnection]:
        with Session(self.engine) as s:
            stmt = select(CodefConnection).where(
                CodefConnection.business_id == business_id,
                CodefConnection.organization_type == organization_type,
                CodefConnection.status == "active",
            )
            return list(s.exec(stmt))

    def list_all(self, business_id: int,
                 organization_type: Optional[str] = None,
                 connection_type: Optional[str] = None) -> list[CodefConnection]:
        """status 무관 (deactivated 제외) — UI 에서 expired/failed 표시용.

        connection_type: 'card_sales' / 'card_purchase' / 'bank' 필터.
        """
        with Session(self.engine) as s:
            stmt = select(CodefConnection).where(
                CodefConnection.business_id == business_id,
                CodefConnection.status != "deactivated",
            )
            if organization_type:
                stmt = stmt.where(CodefConnection.organization_type == organization_type)
            if connection_type:
                stmt = stmt.where(CodefConnection.connection_type == connection_type)
            return list(s.exec(stmt))

    # ─── 내부 헬퍼 ──────────────────────────────────

    def _build_account_payload(self, org, auth_payload: dict,
                                biz_reg_no: str = "") -> tuple[dict, str]:
        """SDK create_account 페이로드 빌드 + auth_method 결정.

        ID/PW: password 키 존재 → "id_pw"
        간편인증: loginType in {kakao,naver,pass,toss,payco,samsung}

        clientType:
          - "P" (개인) — 사장님 본인 명의 카드 (현재 PoC 시나리오)
          - "B" (사업자) — 사업자 카드. auth_payload 에 client_type='B' 명시 시.

        biz_reg_no: 사업자(clientType=B)일 때만 사용.
        """
        client_type = auth_payload.get("client_type", "P").upper()
        if client_type not in {"P", "B"}:
            client_type = "P"

        if "password" in auth_payload:
            # CODEF 매뉴얼 (API.xlsx page 5 — INPUT login Information 필수여부 상세):
            # ID 로그인 시 카드사별 필수 필드 다름.
            #   - 현대카드(0302): cardNo(O), cardPassword(O) — 둘 다 등록 페이로드 필수
            #   - KB카드(0301):   cardNo(△), cardPassword(△) — 옵션 (사이트가 카드소지확인 요구 시)
            #   - 그 외 카드사:   id + password 만으로 충분
            # auth_payload 에 들어온 값만 포함 (없으면 빈 dict → 페이로드에 키 없음).
            encrypted = self._client.encrypt_password(auth_payload["password"])
            account = {
                "countryCode": "KR",
                "businessType": "CD",  # 카드
                "clientType": client_type,
                "organization": org.code,
                "loginType": "1",  # ID/PW
                "id": auth_payload["id"],
                "password": encrypted,
            }
            card_no = auth_payload.get("cardNo")
            if card_no:
                # 평문 전송 (CODEF 페이로드 컨벤션: 숫자형 식별자는 평문)
                account["cardNo"] = re.sub(r"[^0-9]", "", str(card_no))
            card_password = auth_payload.get("cardPassword")
            if card_password:
                # RSA 암호화 (CODEF password 필드 컨벤션 — 조회 API 의
                # cardPassword 파라미터와 동일한 암호화 값을 사용)
                account["cardPassword"] = self._client.encrypt_password(str(card_password))
            if client_type == "B" and biz_reg_no:
                account["businessRegNo"] = biz_reg_no
            return {"accountList": [account]}, "id_pw"

        login_type = auth_payload.get("loginType", "")
        if login_type in {"kakao", "naver", "pass", "toss", "payco", "samsung"}:
            account = {
                "countryCode": "KR",
                "businessType": "CD",
                "clientType": client_type,
                "organization": org.code,
                "loginType": "5",  # 간편인증
                "loginTypeLevel": "1",
            }
            account.update({
                k: v for k, v in auth_payload.items()
                if k not in {"loginType", "client_type"}
            })
            account["loginType"] = "5"
            if client_type == "B" and biz_reg_no:
                account["businessRegNo"] = biz_reg_no
            return {"accountList": [account]}, "simple_auth"

        raise ValueError("auth_payload 가 ID/PW 또는 간편인증 형식이 아님")

    def _upsert_connection(self, business_id, organization, connected_id,
                           auth_method,
                           connection_type: str = "card_sales",
                           card_password_encrypted: Optional[str] = None) -> CodefConnection:
        """connection_type 까지 포함해 unique 키로 upsert.

        같은 사업자·같은 카드사라도 매출(card_sales)·매입(card_purchase) connection 은
        별도 row 로 관리 — 서로 다른 connectedId 가 발급되기 때문.

        Args:
            card_password_encrypted: 이미 RSA 암호화된 카드비번. 조회 API 호출 시
                ``cardPassword`` 파라미터로 그대로 사용 (현대카드 등 필수).
                None 이면 row 의 기존 값을 변경하지 않음 (재인증 시 카드비번 미입력 보존).
        """
        with Session(self.engine) as s:
            stmt = select(CodefConnection).where(
                CodefConnection.business_id == business_id,
                CodefConnection.organization_code == organization.code,
                CodefConnection.organization_type == organization.type,
                CodefConnection.connection_type == connection_type,
            )
            existing = s.exec(stmt).first()
            now = datetime.datetime.utcnow()
            if existing:
                existing.connected_id = connected_id
                existing.auth_method = auth_method
                existing.status = "active"
                existing.last_verified_at = now
                existing.last_failed_at = None
                existing.last_error_code = None
                existing.last_error_message = None
                existing.deactivated_at = None
                if card_password_encrypted is not None:
                    existing.card_password_encrypted = card_password_encrypted
                s.add(existing)
                s.commit()
                s.refresh(existing)
                return existing
            conn = CodefConnection(
                business_id=business_id,
                organization_type=organization.type,
                organization_code=organization.code,
                organization_label=organization.label,
                connected_id=connected_id,
                auth_method=auth_method,
                connection_type=connection_type,
                status="active",
                last_verified_at=now,
                card_password_encrypted=card_password_encrypted,
            )
            s.add(conn)
            s.commit()
            s.refresh(conn)
            return conn
