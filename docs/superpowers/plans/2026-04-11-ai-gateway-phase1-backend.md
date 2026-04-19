# AI Gateway Phase 1 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 셈하나 FastAPI 백엔드에 `/api/ai-gateway/*` 엔드포인트를 구축해 로컬 Ollama(gemma4:e4b)를 프록시하고 관리자/직원 앱이 호출할 수 있게 한다.

**Architecture:** FastAPI 라우터가 `httpx.AsyncClient`로 Ollama HTTP API(`/api/tags`, `/api/generate`)를 호출한다. PostgreSQL `aigatewaylog` 테이블에 요청 메타데이터(모델, 토큰 수, latency, 에러)를 기록한다. JWT 기반 RBAC으로 admin/staff를 구분하고, staff에게만 분당 20건 rate limit을 적용한다. OllamaService는 `httpx.MockTransport`로 단위 테스트가 가능하도록 transport 주입 가능하게 설계한다.

**Tech Stack:** FastAPI 0.109, httpx 0.28 (이미 설치됨), SQLModel 0.0.31, PostgreSQL, python-jose JWT

**Out of Scope (Phase 2+):**
- 임베딩 엔드포인트 (`/embed`)
- 스트리밍 응답 (SSE)
- 프론트엔드(Admin/Staff App) UI 통합
- 영구적 rate limit 저장소 (Phase 1은 in-memory)

---

## Prerequisites — User Actions (Claude cannot do)

이 플랜을 실행하기 전/후에 사용자가 직접 해야 할 것:

1. **(실행 전)** Windows 머신에서 Ollama를 외부 접근 허용으로 설정
   - 시스템 환경변수 `OLLAMA_HOST=0.0.0.0:11434` 추가 (`setx /M OLLAMA_HOST 0.0.0.0:11434`)
   - Ollama 프로세스 재시작 (`taskkill /IM ollama.exe /F` 후 `ollama serve`)
   - 이유: 기본값 `127.0.0.1`은 Orbitron Linux 호스트(192.168.219.101)에서 접근 불가
2. **(실행 전)** Windows 방화벽 11434 인바운드 허용 (사설망 한정)
3. **(실행 후)** Cloudflare Tunnel(twinverseDesk)에 `/api/ai-gateway/*` 라우트 추가 — 단, 셈하나 backend는 Orbitron Linux 호스트에 배포되므로 별도 tunnel 경로가 필요한 건 **Ollama → Orbitron 방향**이 아니라 기존 `https://sodamfn.twinverse.org` 라우트로 자동 커버됨. **Ollama 자체는 사설망 내부에서만 접근 가능하면 충분**하므로 Cloudflare 작업은 실제로는 불필요할 수 있음. Task 7 결과에 따라 판단.
4. **(실행 후)** Orbitron 대시보드에 `AI_GATEWAY_*` 환경변수 4개 직접 등록 (`Orbitron.yaml`만으로는 런타임 주입 안 됨 — 기존 메모리 원칙)

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `SodamApp/backend/services/ollama_service.py` | CREATE | Ollama HTTP 클라이언트 (async, transport 주입 가능) |
| `SodamApp/backend/routers/ai_gateway.py` | CREATE | FastAPI 라우터 — `/health`, `/models`, `/chat` |
| `SodamApp/backend/test_ollama_service.py` | CREATE | `httpx.MockTransport` 기반 단위 테스트 |
| `SodamApp/backend/test_ai_gateway_router.py` | CREATE | `TestClient` 기반 통합 테스트 (mocked OllamaService) |
| `SodamApp/backend/test_ai_gateway_e2e.py` | CREATE | 실제 Ollama 대상 E2E 스모크 (수동 실행) |
| `SodamApp/backend/models.py` | MODIFY (append) | `AiGatewayLog` SQLModel 추가 |
| `SodamApp/backend/init_db.py` | MODIFY | `AiGatewayLog` 임포트해 `create_all` 대상에 포함 |
| `SodamApp/backend/main.py` | MODIFY | `ai_gateway` 라우터 등록 |
| `SodamApp/backend/.env` | MODIFY | `AI_GATEWAY_*` 4개 env var 추가 |
| `Orbitron.yaml` | MODIFY | backend `env:` 블록에 `AI_GATEWAY_*` 4개 추가 |

### 기존 spec과의 차이 (의도적 deviation)

- **경로 prefix**: RESUME-HERE에는 `/v1/ai-gateway/*`로 되어 있지만, 실제 codebase의 모든 라우터는 `/api/*` prefix를 사용한다. 일관성을 위해 `/api/ai-gateway/*`로 변경.
- **모델 파일**: RESUME-HERE의 `backend/models/ai_gateway_log.py`가 아닌 기존 단일 `backend/models.py`에 append. 실제 codebase는 monolithic `models.py`를 사용하고 있어 convention을 따른다.
- **테스트 프레임워크**: 기존 `test_hr.py` 관행을 따라 assert 기반 `python` 스크립트 사용. pytest 인프라 도입하지 않음 (YAGNI).

---

## Task 1: `AiGatewayLog` 모델 추가 및 테이블 생성

**Files:**
- Modify: `SodamApp/backend/models.py` (append 끝에)
- Modify: `SodamApp/backend/init_db.py:3`

- [ ] **Step 1: 현재 models.py 마지막 라인 확인**

Run:
```bash
powershell.exe -NoProfile -Command "(Get-Content 'c:\WORK\SodamFN\SodamApp\backend\models.py' | Measure-Object -Line).Lines"
```
Expected: `667` (또는 그 근처)

- [ ] **Step 2: models.py 끝에 AiGatewayLog 모델 append**

`SodamApp/backend/models.py` 파일 끝(667라인 다음)에 다음을 추가:

```python


class AiGatewayLog(SQLModel, table=True):
    """AI Gateway 요청 로그 (관찰성, 사용량 집계)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    business_id: Optional[int] = Field(default=None, index=True)
    role: str = Field(default="staff")  # admin, staff, superadmin
    endpoint: str = Field(default="chat")  # chat, models, health
    model: str = Field(default="")  # e.g. "gemma4:e4b"
    prompt_tokens: int = Field(default=0)
    completion_tokens: int = Field(default=0)
    latency_ms: int = Field(default=0)
    error: Optional[str] = Field(default=None)
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.now, index=True)
```

**주의**: `Optional`, `Field`, `datetime`, `SQLModel`은 이미 models.py 상단에서 임포트됨. 확인하고 누락 시 추가.

- [ ] **Step 3: init_db.py에 AiGatewayLog 임포트 추가**

`SodamApp/backend/init_db.py:3`의 import 라인을 수정:

기존:
```python
from models import User, Suggestion, StaffChatMessage, InventoryItem, InventoryCheck  # noqa: F401 - import all models so create_all creates their tables
```

변경 후:
```python
from models import User, Suggestion, StaffChatMessage, InventoryItem, InventoryCheck, AiGatewayLog  # noqa: F401 - import all models so create_all creates their tables
```

- [ ] **Step 4: 테이블 생성 실행 및 검증**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -c "from init_db import init_db; init_db()"
```
Expected: `Creating tables...` 출력, 에러 없음

Run (검증):
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -c "from sqlmodel import Session; from database import engine; from sqlalchemy import text; s = Session(engine); r = s.exec(text('SELECT COUNT(*) FROM aigatewaylog')).one(); print(f'aigatewaylog rows: {r}'); s.close()"
```
Expected: `aigatewaylog rows: (0,)` 또는 `aigatewaylog rows: 0`

- [ ] **Step 5: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/models.py SodamApp/backend/init_db.py && git commit -m "feat(ai-gateway): add AiGatewayLog model for request observability"
```

---

## Task 2: OllamaService (httpx 기반, 단위 테스트 포함)

**Files:**
- Create: `SodamApp/backend/services/ollama_service.py`
- Create: `SodamApp/backend/test_ollama_service.py`

- [ ] **Step 1: 실패하는 테스트 먼저 작성**

`SodamApp/backend/test_ollama_service.py` 생성:

```python
"""OllamaService unit tests using httpx.MockTransport.

Run: python test_ollama_service.py
"""
import sys
import asyncio
import httpx

sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')

from services.ollama_service import OllamaService, OllamaError  # noqa: E402


def make_transport(responses):
    """responses: dict[path] -> (status_code, json_body)"""
    def handler(request: httpx.Request) -> httpx.Response:
        key = request.url.path
        if key not in responses:
            return httpx.Response(404, json={"error": f"not mocked: {key}"})
        status, body = responses[key]
        return httpx.Response(status, json=body)
    return httpx.MockTransport(handler)


async def test_health_ok():
    t = make_transport({"/api/tags": (200, {"models": []})})
    svc = OllamaService(base_url="http://mock", transport=t)
    assert await svc.health() is True


async def test_health_fail():
    t = make_transport({"/api/tags": (500, {})})
    svc = OllamaService(base_url="http://mock", transport=t)
    assert await svc.health() is False


async def test_list_models():
    t = make_transport({
        "/api/tags": (200, {"models": [
            {"name": "gemma4:e4b", "size": 9_600_000_000},
            {"name": "qwen2.5:7b", "size": 4_680_000_000},
        ]})
    })
    svc = OllamaService(base_url="http://mock", transport=t)
    ms = await svc.list_models()
    assert len(ms) == 2
    assert ms[0]["name"] == "gemma4:e4b"


async def test_generate_ok():
    t = make_transport({
        "/api/generate": (200, {
            "response": "안녕하세요",
            "prompt_eval_count": 3,
            "eval_count": 5,
            "eval_duration": 50_000_000,
        })
    })
    svc = OllamaService(base_url="http://mock", transport=t)
    r = await svc.generate(model="gemma4:e4b", prompt="안녕")
    assert r["response"] == "안녕하세요"
    assert r["eval_count"] == 5
    assert r["prompt_eval_count"] == 3


async def test_generate_error():
    t = make_transport({"/api/generate": (500, {"error": "boom"})})
    svc = OllamaService(base_url="http://mock", transport=t)
    raised = False
    try:
        await svc.generate(model="x", prompt="y")
    except OllamaError as e:
        raised = True
        assert "500" in str(e)
    assert raised, "OllamaError not raised"


async def test_generate_with_system_and_max_tokens():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={
            "response": "ok", "prompt_eval_count": 1, "eval_count": 1,
        })

    t = httpx.MockTransport(handler)
    svc = OllamaService(base_url="http://mock", transport=t)
    await svc.generate(model="gemma4:e4b", prompt="hi", system="be brief", max_tokens=128)
    body = captured["body"]
    assert body["model"] == "gemma4:e4b"
    assert body["prompt"] == "hi"
    assert body["system"] == "be brief"
    assert body["stream"] is False
    assert body["options"]["num_predict"] == 128


async def main():
    tests = [
        ("health_ok", test_health_ok),
        ("health_fail", test_health_fail),
        ("list_models", test_list_models),
        ("generate_ok", test_generate_ok),
        ("generate_error", test_generate_error),
        ("generate_with_system_and_max_tokens", test_generate_with_system_and_max_tokens),
    ]
    failed = 0
    for name, fn in tests:
        try:
            await fn()
            print(f"  PASS: {name}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL: {name} - {e}")
        except Exception as e:
            failed += 1
            print(f"  ERROR: {name} - {type(e).__name__}: {e}")
    print()
    if failed:
        print(f"{failed} test(s) failed")
        sys.exit(1)
    print("All OllamaService tests passed")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ollama_service.py
```
Expected: `ModuleNotFoundError: No module named 'services.ollama_service'` 또는 ImportError

- [ ] **Step 3: OllamaService 구현**

`SodamApp/backend/services/ollama_service.py` 생성:

```python
"""Ollama HTTP client wrapper for AI Gateway.

Uses httpx.AsyncClient under the hood. Supports transport injection
(httpx.MockTransport) for unit testing without a live Ollama instance.
"""
import os
from typing import Any, Optional

import httpx


class OllamaError(Exception):
    """Raised when Ollama returns a non-200 status or is unreachable."""


class OllamaService:
    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        self.base_url = (
            base_url or os.getenv("AI_GATEWAY_OLLAMA_URL", "http://localhost:11434")
        ).rstrip("/")
        self.timeout = float(
            timeout if timeout is not None else os.getenv("AI_GATEWAY_TIMEOUT_SECONDS", "120")
        )
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        kwargs = {"base_url": self.base_url, "timeout": self.timeout}
        if self._transport is not None:
            kwargs["transport"] = self._transport
        return httpx.AsyncClient(**kwargs)

    async def health(self) -> bool:
        """Return True iff Ollama /api/tags responds 200."""
        try:
            async with self._client() as c:
                r = await c.get("/api/tags")
                return r.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[dict]:
        """Return list of installed models as reported by Ollama /api/tags."""
        async with self._client() as c:
            r = await c.get("/api/tags")
            if r.status_code != 200:
                raise OllamaError(f"list_models failed: {r.status_code} {r.text[:200]}")
            return r.json().get("models", [])

    async def generate(
        self,
        model: str,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> dict[str, Any]:
        """Call Ollama /api/generate with stream=False and return parsed JSON."""
        payload: dict[str, Any] = {"model": model, "prompt": prompt, "stream": False}
        if system:
            payload["system"] = system
        if max_tokens:
            payload["options"] = {"num_predict": int(max_tokens)}

        async with self._client() as c:
            r = await c.post("/api/generate", json=payload)
            if r.status_code != 200:
                raise OllamaError(
                    f"generate failed: {r.status_code} {r.text[:200]}"
                )
            return r.json()
```

- [ ] **Step 4: 테스트 재실행해 PASS 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ollama_service.py
```
Expected:
```
  PASS: health_ok
  PASS: health_fail
  PASS: list_models
  PASS: generate_ok
  PASS: generate_error
  PASS: generate_with_system_and_max_tokens

All OllamaService tests passed
```

- [ ] **Step 5: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/services/ollama_service.py SodamApp/backend/test_ollama_service.py && git commit -m "feat(ai-gateway): add OllamaService httpx client with unit tests"
```

---

## Task 3: 환경변수 4곳 동기화 (.env + Orbitron.yaml)

**Files:**
- Modify: `SodamApp/backend/.env`
- Modify: `Orbitron.yaml`

**CLAUDE.md 원칙에 따라 frontend/postDeploy env 변경은 없음** — AI Gateway는 백엔드 전용이고 `/api/ai-gateway/*`는 기존 `VITE_API_URL`로 이미 커버됨.

- [ ] **Step 1: backend/.env 현재 내용 확인**

Run:
```bash
powershell.exe -NoProfile -Command "type c:\WORK\SodamFN\SodamApp\backend\.env"
```
- 기존 env vars 확인, `AI_GATEWAY_*`가 아직 없음을 확인

- [ ] **Step 2: backend/.env 끝에 4줄 추가**

`SodamApp/backend/.env` 끝에 append:
```
AI_GATEWAY_OLLAMA_URL=http://localhost:11434
AI_GATEWAY_DEFAULT_MODEL=gemma4:e4b
AI_GATEWAY_MAX_TOKENS=2048
AI_GATEWAY_TIMEOUT_SECONDS=120
AI_GATEWAY_STAFF_RATE_LIMIT=20
```

- [ ] **Step 3: Orbitron.yaml backend env 블록에 추가**

`Orbitron.yaml:21-55` (backend `env:` 블록) 끝(`SUPERADMIN_PASSWORD` 바로 뒤)에 다음을 append:

```yaml
      - key: AI_GATEWAY_OLLAMA_URL
        value: "http://192.168.219.100:11434"  # Windows PC Ollama (OLLAMA_HOST=0.0.0.0 필요)
      - key: AI_GATEWAY_DEFAULT_MODEL
        value: "gemma4:e4b"
      - key: AI_GATEWAY_MAX_TOKENS
        value: "2048"
      - key: AI_GATEWAY_TIMEOUT_SECONDS
        value: "120"
      - key: AI_GATEWAY_STAFF_RATE_LIMIT
        value: "20"
```

**프로덕션 URL**은 `localhost`가 아니라 Windows 머신 IP `192.168.219.100`임에 주의. 기존 `AI_GPU_SERVER_URL=http://192.168.219.100:8100` 패턴과 동일.

- [ ] **Step 4: env 로드 검증**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -c "from dotenv import load_dotenv; load_dotenv(); import os; print('OLLAMA_URL:', os.getenv('AI_GATEWAY_OLLAMA_URL')); print('MODEL:', os.getenv('AI_GATEWAY_DEFAULT_MODEL')); print('MAX_TOKENS:', os.getenv('AI_GATEWAY_MAX_TOKENS')); print('TIMEOUT:', os.getenv('AI_GATEWAY_TIMEOUT_SECONDS')); print('RATE_LIMIT:', os.getenv('AI_GATEWAY_STAFF_RATE_LIMIT'))"
```
Expected: 5개 값 모두 정상 출력

- [ ] **Step 5: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/.env Orbitron.yaml && git commit -m "infra(ai-gateway): add AI_GATEWAY_* env vars to .env and Orbitron.yaml"
```

**⚠️ 사용자 보고 필수 (CLAUDE.md 체크리스트)**:
- [x] Orbitron.yaml backend env 업데이트 완료
- [ ] Orbitron.yaml frontend env 업데이트 **불필요** (Gateway는 backend 전용)
- [ ] Orbitron.yaml postDeploy env 업데이트 **불필요**
- [ ] Orbitron 대시보드에 5개 env var 수동 등록 필요 (Orbitron.yaml은 런타임 주입 안 됨)

---

## Task 4: ai_gateway 라우터 + `/health` & `/models` 엔드포인트

**Files:**
- Create: `SodamApp/backend/routers/ai_gateway.py`
- Create: `SodamApp/backend/test_ai_gateway_router.py`
- Modify: `SodamApp/backend/main.py:9` (imports), `main.py:80-100` (라우터 등록)

- [ ] **Step 1: 실패하는 라우터 테스트 작성 (health, models만)**

`SodamApp/backend/test_ai_gateway_router.py` 생성:

```python
"""ai_gateway router integration tests using FastAPI TestClient.

Requires:
- PostgreSQL 연결 가능 (main.py lifespan이 init_db 호출)
- AI_GATEWAY_* env vars 로드 가능 (.env)

Run: python test_ai_gateway_router.py
"""
import sys

sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from routers.ai_gateway import get_ollama  # noqa: E402
from routers.auth import get_current_user, get_active_user  # noqa: E402


class FakeUser:
    id = 9999
    role = "admin"
    username = "test_admin"
    business_id = 1
    staff_id = None
    real_name = "Test Admin"
    grade = "admin"
    profile_image = None
    subscription_type = None


def override_user():
    return FakeUser()


class FakeOllama:
    base_url = "http://fake"

    async def health(self):
        return True

    async def list_models(self):
        return [
            {"name": "gemma4:e4b", "size": 9_600_000_000},
            {"name": "qwen2.5:7b", "size": 4_680_000_000},
        ]

    async def generate(self, model, prompt, system=None, max_tokens=None):
        return {
            "response": f"echo:{prompt}",
            "prompt_eval_count": 5,
            "eval_count": 3,
            "eval_duration": 30_000_000,
        }


def get_fake_ollama():
    return FakeOllama()


# Apply overrides at module load
app.dependency_overrides[get_current_user] = override_user
app.dependency_overrides[get_active_user] = override_user
app.dependency_overrides[get_ollama] = get_fake_ollama


client = TestClient(app)


def test_health():
    r = client.get("/api/ai-gateway/health")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert "base_url" in data


def test_models():
    r = client.get("/api/ai-gateway/models")
    assert r.status_code == 200, r.text
    data = r.json()
    names = [m["name"] for m in data["models"]]
    assert "gemma4:e4b" in names


def run_all():
    tests = [test_health, test_models]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS: {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL: {t.__name__} - {e}")
        except Exception as e:
            failed += 1
            print(f"  ERROR: {t.__name__} - {type(e).__name__}: {e}")
    print()
    if failed:
        print(f"{failed} test(s) failed")
        sys.exit(1)
    print("All ai_gateway router tests passed")


if __name__ == "__main__":
    run_all()
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ai_gateway_router.py
```
Expected: `ModuleNotFoundError: No module named 'routers.ai_gateway'`

- [ ] **Step 3: ai_gateway.py 라우터 scaffold 작성 (health + models만)**

`SodamApp/backend/routers/ai_gateway.py` 생성:

```python
"""AI Gateway router — proxies local Ollama for chat completion.

Endpoints:
- GET  /api/ai-gateway/health    - Ollama reachability
- GET  /api/ai-gateway/models    - list installed Ollama models (auth required)
- POST /api/ai-gateway/chat      - generate text with default model (auth + rate limit)
"""
import os

from fastapi import APIRouter, Depends, HTTPException

from models import User as AuthUser
from routers.auth import get_active_user
from services.ollama_service import OllamaError, OllamaService

router = APIRouter(prefix="/ai-gateway", tags=["AI Gateway"])

DEFAULT_MODEL = os.getenv("AI_GATEWAY_DEFAULT_MODEL", "gemma4:e4b")
DEFAULT_MAX_TOKENS = int(os.getenv("AI_GATEWAY_MAX_TOKENS", "2048"))


def get_ollama() -> OllamaService:
    """FastAPI dependency — can be overridden in tests."""
    return OllamaService()


@router.get("/health")
async def health(ollama: OllamaService = Depends(get_ollama)):
    ok = await ollama.health()
    return {"ok": ok, "base_url": ollama.base_url}


@router.get("/models")
async def list_models(
    _user: AuthUser = Depends(get_active_user),
    ollama: OllamaService = Depends(get_ollama),
):
    try:
        raw = await ollama.list_models()
    except OllamaError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {
        "models": [
            {"name": m.get("name"), "size": m.get("size")}
            for m in raw
        ],
        "default": DEFAULT_MODEL,
    }
```

- [ ] **Step 4: main.py에 라우터 등록**

`SodamApp/backend/main.py:9` import 라인에 `ai_gateway` 추가:

기존:
```python
from routers import stats, ocr, expense, hr, upload, payroll, auth, contract, settings, finance, profitloss, products, revenue, purchase, purchase_requests, emergency_contacts, announcements, suggestions, staff_chat, deploy, distribute, superadmin
```

변경 후:
```python
from routers import stats, ocr, expense, hr, upload, payroll, auth, contract, settings, finance, profitloss, products, revenue, purchase, purchase_requests, emergency_contacts, announcements, suggestions, staff_chat, deploy, distribute, superadmin, ai_gateway
```

그리고 `main.py:100` 바로 다음(distribute 등록 뒤, `from routers import inventory_check` 앞)에 아래 추가:

```python
app.include_router(ai_gateway.router, prefix="/api")
```

- [ ] **Step 5: 테스트 재실행**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ai_gateway_router.py
```
Expected:
```
  PASS: test_health
  PASS: test_models

All ai_gateway router tests passed
```

만약 lifespan에서 DB 에러가 나면: PostgreSQL 연결 확인 (`.env`의 `DATABASE_URL`).

- [ ] **Step 6: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/routers/ai_gateway.py SodamApp/backend/main.py SodamApp/backend/test_ai_gateway_router.py && git commit -m "feat(ai-gateway): add router scaffold with /health and /models endpoints"
```

---

## Task 5: `/chat` 엔드포인트 + AiGatewayLog 기록

**Files:**
- Modify: `SodamApp/backend/routers/ai_gateway.py` (endpoint 추가)
- Modify: `SodamApp/backend/test_ai_gateway_router.py` (테스트 추가)

- [ ] **Step 1: 실패하는 chat 테스트 추가**

`test_ai_gateway_router.py`의 `test_models` 뒤에 추가:

```python
def test_chat_basic():
    r = client.post(
        "/api/ai-gateway/chat",
        json={"prompt": "안녕"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["response"] == "echo:안녕"
    assert data["prompt_tokens"] == 5
    assert data["completion_tokens"] == 3
    assert data["model"] == "gemma4:e4b"
    assert "latency_ms" in data


def test_chat_custom_model():
    r = client.post(
        "/api/ai-gateway/chat",
        json={"prompt": "hi", "model": "qwen2.5:7b", "max_tokens": 100},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["model"] == "qwen2.5:7b"


def test_chat_log_persisted():
    """Verify AiGatewayLog row is created after chat call."""
    from sqlmodel import Session, select
    from database import engine
    from models import AiGatewayLog

    r = client.post("/api/ai-gateway/chat", json={"prompt": "로그 테스트"})
    assert r.status_code == 200, r.text

    with Session(engine) as s:
        latest = s.exec(
            select(AiGatewayLog).where(AiGatewayLog.user_id == FakeUser.id).order_by(AiGatewayLog.id.desc())
        ).first()
        assert latest is not None
        assert latest.endpoint == "chat"
        assert latest.model == "gemma4:e4b"
        assert latest.prompt_tokens == 5
        assert latest.completion_tokens == 3
        assert latest.latency_ms >= 0
        assert latest.error is None
```

그리고 `run_all()`의 `tests` 리스트에 3개 추가:
```python
    tests = [test_health, test_models, test_chat_basic, test_chat_custom_model, test_chat_log_persisted]
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ai_gateway_router.py
```
Expected: `test_chat_basic`에서 404 또는 `test_chat_*` 전체 실패 (엔드포인트 없음)

- [ ] **Step 3: `/chat` 엔드포인트 구현**

`SodamApp/backend/routers/ai_gateway.py`에 아래 추가. 상단 import 블록을 다음으로 교체:

```python
"""AI Gateway router — proxies local Ollama for chat completion.

Endpoints:
- GET  /api/ai-gateway/health    - Ollama reachability
- GET  /api/ai-gateway/models    - list installed Ollama models (auth required)
- POST /api/ai-gateway/chat      - generate text with default model (auth + rate limit)
"""
import os
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from models import AiGatewayLog, User as AuthUser
from routers.auth import get_active_user
from services.database_service import DatabaseService
from services.ollama_service import OllamaError, OllamaService
from tenant_filter import get_bid_from_token
```

그리고 파일 끝에 아래 엔드포인트 추가:

```python
class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    system: Optional[str] = None
    max_tokens: Optional[int] = None


def _log_request(
    user_id: int,
    business_id: Optional[int],
    role: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    latency_ms: int,
    error: Optional[str],
) -> None:
    svc = DatabaseService()
    try:
        log = AiGatewayLog(
            user_id=user_id,
            business_id=business_id,
            role=role,
            endpoint="chat",
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=latency_ms,
            error=error,
        )
        svc.session.add(log)
        svc.session.commit()
    finally:
        svc.close()


@router.post("/chat")
async def chat(
    req: ChatRequest,
    user: AuthUser = Depends(get_active_user),
    bid: Optional[int] = Depends(get_bid_from_token),
    ollama: OllamaService = Depends(get_ollama),
):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")

    model = req.model or DEFAULT_MODEL
    max_tokens = req.max_tokens or DEFAULT_MAX_TOKENS

    started = time.perf_counter()
    response_text = ""
    error: Optional[str] = None
    prompt_tokens = 0
    completion_tokens = 0

    try:
        result = await ollama.generate(
            model=model,
            prompt=req.prompt,
            system=req.system,
            max_tokens=max_tokens,
        )
        response_text = result.get("response", "")
        prompt_tokens = int(result.get("prompt_eval_count") or 0)
        completion_tokens = int(result.get("eval_count") or 0)
    except OllamaError as e:
        error = str(e)
    except Exception as e:
        error = f"unexpected: {type(e).__name__}: {e}"

    latency_ms = int((time.perf_counter() - started) * 1000)

    _log_request(
        user_id=user.id,
        business_id=bid,
        role=user.role,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        latency_ms=latency_ms,
        error=error,
    )

    if error:
        raise HTTPException(status_code=502, detail=error)

    return {
        "response": response_text,
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "latency_ms": latency_ms,
    }
```

- [ ] **Step 4: 테스트 재실행**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ai_gateway_router.py
```
Expected:
```
  PASS: test_health
  PASS: test_models
  PASS: test_chat_basic
  PASS: test_chat_custom_model
  PASS: test_chat_log_persisted

All ai_gateway router tests passed
```

- [ ] **Step 5: 테스트 데이터 정리 (선택)**

Run (테스트 로그 레코드 삭제):
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -c "from sqlmodel import Session, delete; from database import engine; from models import AiGatewayLog; s = Session(engine); s.exec(delete(AiGatewayLog).where(AiGatewayLog.user_id == 9999)); s.commit(); print('cleaned'); s.close()"
```

- [ ] **Step 6: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/routers/ai_gateway.py SodamApp/backend/test_ai_gateway_router.py && git commit -m "feat(ai-gateway): add /chat endpoint with AiGatewayLog persistence"
```

---

## Task 6: Rate Limiting (staff 분당 20건)

**Files:**
- Modify: `SodamApp/backend/routers/ai_gateway.py` (rate limit helper 추가 + /chat에서 호출)
- Modify: `SodamApp/backend/test_ai_gateway_router.py` (rate limit 테스트 추가)

- [ ] **Step 1: 실패하는 rate limit 테스트 작성**

`test_ai_gateway_router.py`에 추가 (기존 FakeUser 아래):

```python
class FakeStaffUser:
    id = 8888
    role = "staff"
    username = "test_staff"
    business_id = 1
    staff_id = 1
    real_name = "Test Staff"
    grade = "normal"
    profile_image = None
    subscription_type = None


def override_staff_user():
    return FakeStaffUser()


def test_rate_limit_staff():
    """Staff should be rate-limited after AI_GATEWAY_STAFF_RATE_LIMIT requests/min."""
    import os
    from routers.ai_gateway import _rate_buckets

    # Reset bucket state for this test user
    _rate_buckets.clear()

    limit = int(os.getenv("AI_GATEWAY_STAFF_RATE_LIMIT", "20"))

    # Swap auth override temporarily to staff
    app.dependency_overrides[get_active_user] = override_staff_user
    try:
        for i in range(limit):
            r = client.post("/api/ai-gateway/chat", json={"prompt": f"n={i}"})
            assert r.status_code == 200, f"request {i} got {r.status_code}"
        # (limit+1)번째는 429
        r = client.post("/api/ai-gateway/chat", json={"prompt": "overflow"})
        assert r.status_code == 429, f"expected 429, got {r.status_code}: {r.text}"
    finally:
        app.dependency_overrides[get_active_user] = override_user
        _rate_buckets.clear()


def test_rate_limit_admin_unlimited():
    """Admin should NOT be rate-limited."""
    from routers.ai_gateway import _rate_buckets

    _rate_buckets.clear()
    # 25 requests as admin (limit=20) should all succeed
    for i in range(25):
        r = client.post("/api/ai-gateway/chat", json={"prompt": f"a={i}"})
        assert r.status_code == 200, f"admin request {i} got {r.status_code}"
    _rate_buckets.clear()
```

`run_all`의 `tests` 리스트에 추가:
```python
    tests = [
        test_health, test_models,
        test_chat_basic, test_chat_custom_model, test_chat_log_persisted,
        test_rate_limit_staff, test_rate_limit_admin_unlimited,
    ]
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ai_gateway_router.py
```
Expected: `test_rate_limit_staff`에서 `_rate_buckets` ImportError 또는 expected 429 but got 200

- [ ] **Step 3: rate limit helper 구현 및 /chat에서 호출**

`SodamApp/backend/routers/ai_gateway.py`의 import 블록 바로 아래(라우터 생성 직전)에 추가:

```python
from collections import defaultdict, deque
from time import monotonic

STAFF_RATE_LIMIT_PER_MIN = int(os.getenv("AI_GATEWAY_STAFF_RATE_LIMIT", "20"))

# In-memory rate limit buckets: {user_id: deque[monotonic_timestamp]}
# Phase 1 only — will move to Redis/DB in Phase 2 for multi-worker safety.
_rate_buckets: dict[int, "deque[float]"] = defaultdict(deque)


def _check_rate_limit(user_id: int, is_admin: bool) -> None:
    if is_admin:
        return
    now = monotonic()
    bucket = _rate_buckets[user_id]
    while bucket and now - bucket[0] > 60.0:
        bucket.popleft()
    if len(bucket) >= STAFF_RATE_LIMIT_PER_MIN:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {STAFF_RATE_LIMIT_PER_MIN} requests/minute",
        )
    bucket.append(now)
```

그리고 `chat()` 함수의 `if not req.prompt...` 검증 바로 다음에 rate limit 호출 추가:

```python
    is_admin = user.role in ("admin", "superadmin")
    _check_rate_limit(user.id, is_admin)
```

- [ ] **Step 4: 테스트 재실행**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ai_gateway_router.py
```
Expected: 7개 테스트 모두 PASS

- [ ] **Step 5: 테스트 데이터 정리**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -c "from sqlmodel import Session, delete; from database import engine; from models import AiGatewayLog; s = Session(engine); s.exec(delete(AiGatewayLog).where(AiGatewayLog.user_id.in_([9999, 8888]))); s.commit(); print('cleaned'); s.close()"
```

- [ ] **Step 6: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/routers/ai_gateway.py SodamApp/backend/test_ai_gateway_router.py && git commit -m "feat(ai-gateway): add in-memory staff rate limit (20/min, admin unlimited)"
```

**Phase 2 note**: `_rate_buckets`는 in-memory이므로 gunicorn multi-worker 배포에서 worker별로 분리됨. 프로덕션에 맞춰 Redis 기반으로 전환 필요.

---

## Task 7: E2E 스모크 테스트 (실제 Ollama)

**Files:**
- Create: `SodamApp/backend/test_ai_gateway_e2e.py`

- [ ] **Step 1: E2E 스모크 스크립트 작성**

`SodamApp/backend/test_ai_gateway_e2e.py` 생성:

```python
"""End-to-end smoke test against REAL Ollama.

Prerequisites:
- Ollama running on AI_GATEWAY_OLLAMA_URL (default http://localhost:11434)
- gemma4:e4b model installed

Run: python test_ai_gateway_e2e.py
"""
import sys
import asyncio

sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')

from dotenv import load_dotenv  # noqa: E402
load_dotenv()

from services.ollama_service import OllamaService  # noqa: E402


async def main():
    svc = OllamaService()
    print(f"Base URL: {svc.base_url}")
    print(f"Timeout:  {svc.timeout}s")

    # 1. Health
    ok = await svc.health()
    assert ok, f"Ollama not reachable at {svc.base_url}"
    print("[OK] health")

    # 2. Models
    models = await svc.list_models()
    names = [m.get("name") for m in models]
    print(f"[OK] models ({len(models)}): {names}")
    assert "gemma4:e4b" in names, f"gemma4:e4b missing from {names}"

    # 3. Generate (Korean)
    print("[..] generating Korean response (may take 5-30s)...")
    r = await svc.generate(
        model="gemma4:e4b",
        prompt="안녕하세요. '1+2='를 한국어로 풀어서 답해주세요. 한 문장으로.",
        max_tokens=200,
    )
    print(f"[OK] response:")
    print(f"    {r.get('response', '')}")
    print(f"    prompt_tokens={r.get('prompt_eval_count')} "
          f"completion_tokens={r.get('eval_count')}")
    eval_dur = r.get("eval_duration", 0)
    if eval_dur and r.get("eval_count"):
        tps = r["eval_count"] / (eval_dur / 1e9)
        print(f"    throughput: {tps:.1f} tok/s")

    print()
    print("E2E smoke test passed")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 실제 Ollama 기동 확인**

Run:
```bash
powershell.exe -NoProfile -Command "Invoke-RestMethod -Uri http://localhost:11434/api/tags -TimeoutSec 5 | Select-Object -ExpandProperty models | Select-Object name"
```
Expected: 모델 리스트, gemma4:e4b 포함

만약 실패하면: `ollama serve`를 새 터미널에서 실행하거나, 이미 실행 중이면 방화벽/포트 확인.

- [ ] **Step 3: E2E 스크립트 실행**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python test_ai_gateway_e2e.py
```
Expected:
```
Base URL: http://localhost:11434
Timeout:  120.0s
[OK] health
[OK] models (8): ['gpt-oss:20b', 'gemma4:e4b', ...]
[..] generating Korean response (may take 5-30s)...
[OK] response:
    <한국어 응답>
    prompt_tokens=~20 completion_tokens=~30
    throughput: ~100+ tok/s

E2E smoke test passed
```

- [ ] **Step 4: Commit**

```bash
cd c:/WORK/SodamFN && git add SodamApp/backend/test_ai_gateway_e2e.py && git commit -m "test(ai-gateway): add e2e smoke test against real Ollama"
```

---

## Task 8: 전체 통합 검증 (수동 curl 테스트)

**Files:** (수정 없음 — 검증 단계)

- [ ] **Step 1: Backend 서버 기동 (새 터미널)**

Run (background 또는 별도 터미널):
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python main.py
```
Expected: `Uvicorn running on http://0.0.0.0:8000`

- [ ] **Step 2: admin 토큰 발급**

Run:
```bash
powershell.exe -NoProfile -Command "$form = @{ username='admin'; password='admin1234' }; $r = Invoke-RestMethod -Uri http://localhost:8000/api/auth/login -Method Post -Body $form; Write-Host $r.access_token"
```
Expected: 긴 JWT 문자열 출력. 이 값을 `$TOKEN`으로 저장.

- [ ] **Step 3: /health 호출 (인증 불필요)**

Run:
```bash
powershell.exe -NoProfile -Command "Invoke-RestMethod http://localhost:8000/api/ai-gateway/health"
```
Expected: `{"ok": true, "base_url": "http://localhost:11434"}`

- [ ] **Step 4: /models 호출 (토큰 필요)**

`$TOKEN`을 Step 2에서 받은 값으로 치환:
```bash
powershell.exe -NoProfile -Command "$token='...'; Invoke-RestMethod http://localhost:8000/api/ai-gateway/models -Headers @{Authorization=\"Bearer $token\"}"
```
Expected: `models` 배열에 gemma4:e4b 포함

- [ ] **Step 5: /chat 호출 (한국어 프롬프트)**

```bash
powershell.exe -NoProfile -Command "$token='...'; $body = @{ prompt='1+1 은 얼마인가요? 숫자만 답해.' } | ConvertTo-Json; Invoke-RestMethod http://localhost:8000/api/ai-gateway/chat -Method Post -Body $body -ContentType 'application/json; charset=utf-8' -Headers @{Authorization=\"Bearer $token\"}"
```
Expected: `response`에 "2" 포함, `latency_ms`, `prompt_tokens`, `completion_tokens` 모두 양수

- [ ] **Step 6: DB에 로그 기록 확인**

Run:
```bash
cd c:/WORK/SodamFN/SodamApp/backend && python -c "from sqlmodel import Session, select; from database import engine; from models import AiGatewayLog; s = Session(engine); logs = s.exec(select(AiGatewayLog).order_by(AiGatewayLog.id.desc()).limit(5)).all(); [print(f'{l.id} u={l.user_id} model={l.model} tok={l.prompt_tokens}+{l.completion_tokens} lat={l.latency_ms}ms err={l.error}') for l in logs]; s.close()"
```
Expected: 최근 호출 5건 출력, error=None

- [ ] **Step 7: 서버 종료**

기동 중인 Uvicorn을 Ctrl+C로 종료.

- [ ] **Step 8: 최종 Commit (수정사항이 있다면)**

검증 단계에서 버그 발견 시 수정 후:
```bash
cd c:/WORK/SodamFN && git add -A && git commit -m "fix(ai-gateway): <수정 내용>"
```

버그 없으면 이 task는 commit 없음 (검증만).

---

## Completion Checklist

- [ ] Task 1: AiGatewayLog 모델 추가 (models.py + init_db.py)
- [ ] Task 2: OllamaService + 6개 단위 테스트 PASS
- [ ] Task 3: `.env` + `Orbitron.yaml` 환경변수 5개 동기화
- [ ] Task 4: `/health` + `/models` 엔드포인트 + TestClient 테스트 PASS
- [ ] Task 5: `/chat` 엔드포인트 + AiGatewayLog 기록 + 테스트 PASS
- [ ] Task 6: Rate limit (staff 20/min, admin 무제한) + 테스트 PASS
- [ ] Task 7: E2E 스모크 (실제 Ollama, gemma4:e4b 한국어) PASS
- [ ] Task 8: curl 기반 수동 통합 검증 완료 + DB 로그 확인

## 사용자에게 최종 보고 (CLAUDE.md 체크리스트)

```
⚠️ 배포 환경변수 체크:
- [x] Orbitron.yaml backend env 업데이트 완료 (5개 추가)
- [x] Orbitron.yaml frontend env 업데이트 불필요 (백엔드 전용)
- [x] Orbitron.yaml postDeploy env 업데이트 불필요
- [ ] Orbitron 대시보드에 AI_GATEWAY_* 5개 수동 등록 필요
- [ ] (Windows 머신) OLLAMA_HOST=0.0.0.0:11434 setx + 방화벽 11434 허용
```

## Out of Scope (Phase 2+ 이슈로 남김)

1. **스트리밍 응답 (SSE)**: `stream=true`로 chunked 전송, 프론트엔드 ReadableStream 처리. UX 개선에 중요하지만 Phase 1은 non-stream만.
2. **임베딩 엔드포인트**: `nomic-embed-text` 또는 `mxbai-embed-large` 설치 후 `/api/ai-gateway/embed` 추가. RAG/시맨틱 검색용.
3. **Rate limit 영구화**: Redis/DB 기반으로 전환 (gunicorn multi-worker 대응).
4. **프론트엔드 통합**: Admin/Staff App에 챗 UI 추가. 현재는 backend API만.
5. **프롬프트 템플릿/시스템 메시지 라이브러리**: 매출 분석, HR 질의 등 도메인 프리셋.
6. **비용 집계 / 쿼터 관리**: AiGatewayLog 기반으로 관리자 대시보드에 월간 사용량 표시.
7. **모델 선택 라우팅**: 요청 특성(길이/카테고리)에 따라 다른 모델 자동 선택.
