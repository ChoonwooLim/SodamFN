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
        return self._upsert_connection(
            business_id=business_id,
            organization=org,
            connected_id=result.connected_id,
            auth_method=auth_method,
            connection_type=connection_type,
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

        extra_info = (response.get("data") or {}).get("extraInfo") or {}
        # extraInfo 가 비어있는 일부 케이스 — data 자체를 그대로 사용
        if not extra_info:
            extra_info = response.get("data") or {}

        now = datetime.datetime.utcnow()
        expires_at = now + datetime.timedelta(minutes=2)

        with Session(self.engine) as s:
            pending = PendingCodefAuth(
                business_id=business_id,
                organization_code=card_corp_code,
                connection_type=connection_type,
                auth_method=auth_method,
                payload_json=json.dumps(sdk_payload, ensure_ascii=False),
                extra_info_json=json.dumps(extra_info, ensure_ascii=False),
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

        1단계에서 저장한 payload + extraInfo 를 그대로 재전송하되 ``is2Way=true`` +
        ``twoWayInfo`` 를 첨부. CODEF 가 본인인증 완료 사실을 확인하면 connectedId 발급.
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
            extra_info = json.loads(pending.extra_info_json or "{}")
            business_id = pending.business_id
            card_corp_code = pending.organization_code
            connection_type = pending.connection_type
            auth_method = pending.auth_method

        # 2단계 — is2Way + twoWayInfo 첨부
        account = sdk_payload["accountList"][0]
        account["is2Way"] = "true"
        account["twoWayInfo"] = extra_info

        result = self._client.create_account(sdk_payload)

        org = get_organization(card_corp_code)
        conn = self._upsert_connection(
            business_id=business_id,
            organization=org,
            connected_id=result.connected_id,
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
            # 카드 비밀번호 (현대카드 등 일부 카드사 필수 — 2단계 인증).
            # CODEF 표준: password2 (RSA 암호화). 평문 cardPassword 도 함께 전송 —
            # 카드사별로 인식 키가 다를 수 있어 안전 차원에서 둘 다 포함.
            card_pw = auth_payload.get("cardPassword")
            if card_pw:
                account["password2"] = self._client.encrypt_password(str(card_pw))
                account["cardPassword"] = str(card_pw)
            # 생년월일 (일부 카드사 필수, YYMMDD 또는 YYYYMMDD 평문)
            birth = auth_payload.get("birthDate")
            if birth:
                account["birthDate"] = str(birth)
            # CVC (드물게 필요)
            cvc = auth_payload.get("cvc")
            if cvc:
                account["cvc"] = str(cvc)
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
                           connection_type: str = "card_sales") -> CodefConnection:
        """connection_type 까지 포함해 unique 키로 upsert.

        같은 사업자·같은 카드사라도 매출(card_sales)·매입(card_purchase) connection 은
        별도 row 로 관리 — 서로 다른 connectedId 가 발급되기 때문.
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
            )
            s.add(conn)
            s.commit()
            s.refresh(conn)
            return conn
