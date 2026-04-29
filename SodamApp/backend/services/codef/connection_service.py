"""connectedId 라이프사이클 관리.

등록 / 재인증 / 해제 / 조회 + DB 동기화.
인증 페이로드를 받아 RSA 암호화 → CodefClient.create_account → DB 저장.

추가본인확인 발생 시 CodefAdditionalAuth 예외를 그대로 라우터로 전파 →
라우터가 SMS 코드 입력 폼을 띄움.
"""
import datetime
from typing import Optional

from sqlmodel import Session, select

from models import CodefConnection
from .codef_client import CodefClient
from .organization_catalog import get_organization, AuthPolicy


class CodefConnectionService:
    def __init__(self, engine, client: Optional[CodefClient] = None):
        self.engine = engine
        self._client = client or CodefClient()

    # ─── 등록 / 재인증 / 해제 ───────────────────────

    def register_card(self, business_id: int, card_corp_code: str,
                      auth_payload: dict) -> CodefConnection:
        """auth_payload 형식:
        - ID/PW:    {"id": "...", "password": "..."}
        - 간편인증: {"identity": "...", "loginType": "kakao", "birthDate": "...", ...}
        """
        org = get_organization(card_corp_code)
        if not org or org.type != "card":
            raise ValueError(f"알 수 없는 카드사: {card_corp_code}")

        sdk_payload, auth_method = self._build_account_payload(org, auth_payload)
        result = self._client.create_account(sdk_payload)
        return self._upsert_connection(
            business_id=business_id,
            organization=org,
            connected_id=result.connected_id,
            auth_method=auth_method,
        )

    def reverify(self, connection_id: int, auth_payload: dict) -> CodefConnection:
        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            if not conn:
                raise ValueError(f"connection {connection_id} 없음")
            org = get_organization(conn.organization_code)
            if not org:
                raise ValueError(f"알 수 없는 organization_code: {conn.organization_code}")

        sdk_payload, auth_method = self._build_account_payload(org, auth_payload)
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
                 organization_type: Optional[str] = None) -> list[CodefConnection]:
        """status 무관 (deactivated 제외) — UI 에서 expired/failed 표시용."""
        with Session(self.engine) as s:
            stmt = select(CodefConnection).where(
                CodefConnection.business_id == business_id,
                CodefConnection.status != "deactivated",
            )
            if organization_type:
                stmt = stmt.where(CodefConnection.organization_type == organization_type)
            return list(s.exec(stmt))

    # ─── 내부 헬퍼 ──────────────────────────────────

    def _build_account_payload(self, org, auth_payload: dict) -> tuple[dict, str]:
        """SDK create_account 페이로드 빌드 + auth_method 결정.

        ID/PW: password 키 존재 → "id_pw"
        간편인증: loginType in {kakao,naver,pass,toss,payco,samsung}
        """
        if "password" in auth_payload:
            encrypted = self._client.encrypt_password(auth_payload["password"])
            payload = {
                "accountList": [{
                    "countryCode": "KR",
                    "businessType": "CD",  # 카드
                    "clientType": "B",  # 기업
                    "organization": org.code,
                    "loginType": "1",  # ID/PW
                    "id": auth_payload["id"],
                    "password": encrypted,
                }]
            }
            return payload, "id_pw"

        login_type = auth_payload.get("loginType", "")
        if login_type in {"kakao", "naver", "pass", "toss", "payco", "samsung"}:
            payload_inner = {
                "countryCode": "KR",
                "businessType": "CD",
                "clientType": "B",
                "organization": org.code,
                "loginType": "5",  # 간편인증
                "loginTypeLevel": "1",
            }
            payload_inner.update({
                k: v for k, v in auth_payload.items()
                if k not in {"loginType"}
            })
            payload_inner["loginType"] = "5"
            return {"accountList": [payload_inner]}, "simple_auth"

        raise ValueError("auth_payload 가 ID/PW 또는 간편인증 형식이 아님")

    def _upsert_connection(self, business_id, organization, connected_id,
                           auth_method) -> CodefConnection:
        with Session(self.engine) as s:
            stmt = select(CodefConnection).where(
                CodefConnection.business_id == business_id,
                CodefConnection.organization_code == organization.code,
                CodefConnection.organization_type == organization.type,
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
                status="active",
                last_verified_at=now,
            )
            s.add(conn)
            s.commit()
            s.refresh(conn)
            return conn
