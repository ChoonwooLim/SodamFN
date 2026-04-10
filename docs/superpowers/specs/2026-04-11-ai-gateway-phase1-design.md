# AI Gateway Phase 1 — 설계 문서

- **작성일**: 2026-04-11
- **작성자**: Claude (with Steven Lim)
- **대상 프로젝트**: 셈하나(SEMHANA) / SodamFN
- **위치**: `SodamApp/backend/services/ai_gateway/`
- **단계**: Phase 1 (Foundation + 기존 기능 통합)

---

## 0. 목적 및 배경

### 왜 이 작업이 필요한가

셈하나 백엔드에는 이미 여러 AI 기능이 존재한다:
- `delivery_images.py` — 배달앱 이미지 생성/편집 (self-hosted Flux → Replicate → OpenAI 캐스케이드)
- `ocr.py` — 영수증 OCR (현재 Mock)
- `smart_classifier.py` — 거래처 분류 (규칙 기반 + 사용자 학습)
- 재무 인사이트 / 마케팅 카피 / 마케팅 이미지 — 일부 미구현, 일부 하드코딩

각 기능이 자체적으로 프로바이더를 호출하고 있어 다음 문제가 있다:
1. **프로바이더 교체 불가**: 기능마다 하드코딩된 SDK/URL
2. **관리 UI 없음**: 어떤 기능이 어떤 모델을 쓰는지, 어디서 장애가 났는지 파악 불가
3. **클라우드 이전 비용 큼**: 현재 localhost:8100, localhost:11434 등 경로 의존성
4. **Gemma 4 등 신규 모델 도입 시 코드 수정 필요**

### 목표

1. **OpenAI-Compatible Gateway** 단일 진입점 구축 (채팅/이미지/비디오)
2. **DB 기반 프로바이더 레지스트리**: 코드 수정 없이 관리자 UI에서 프로바이더 추가/전환
3. **Cascading Fallback + Circuit Breaker**: self-hosted 장애 시 자동으로 클라우드 API로 폴백
4. **Gemma 4 로컬 설치 및 연동**: dual RTX 3090 (GPU 1 전용)
5. **Flux / Wan2.2 / HiDream 재사용**: 기존 자체 호스팅 서비스를 Gateway 뒤에 포섭
6. **미래 이전 비용 최소화**: 모든 URL/모델명은 환경변수 + DB로만 참조

### 이 Phase 1에 **포함되지 않는** 것 (Phase 2+로 이월)

- 각 기능의 **비즈니스 로직 개선** (OCR 정확도 튜닝, 마케팅 카피 프롬프트 엔지니어링 등)
- LoRA / 파인튜닝 / 임베딩 서비스
- 스트리밍 응답 (SSE) — 추후 Phase
- 멀티 테넌트 요금제별 쿼터
- 관리자가 아닌 일반 사장님용 AI 설정

---

## 1. 아키텍처 개요

### 전체 흐름

```
[기능 코드]         (예: ocr.py, delivery_images.py, insights.py)
    │
    │ ai.chat(messages=..., feature="ocr") 등
    ▼
[AIGateway]         — 단일 싱글톤 진입점
    │
    ├─► [ProviderSelector] ─► ProviderRegistry(DB 캐시 30s) + HealthCache(30s) + CircuitBreaker
    │        │ 1순위: feature-specific default  (GlobalSetting)
    │        │ 2순위: capability 만족 + priority 순
    │        │ 3순위: fallback chain (최대 3회)
    │
    ├─► [Adapter]   — 프로바이더별 HTTP 어댑터 (OpenAI-compat / Anthropic / Diffusers / WanGP / ComfyUI)
    │        │
    │        ▼
    │   [외부 프로바이더]  (Ollama, Flux HTTP, WanGP HTTP, ComfyUI HTTP, Anthropic, OpenAI, Gemini, Replicate…)
    │
    └─► [RequestLogger] ─► ai_request_log 테이블 (성공/실패, latency, fallback chain)
```

### 핵심 컴포넌트

| 컴포넌트 | 책임 | 파일 |
|---|---|---|
| `AIGateway` | 기능 코드의 단일 진입점 (chat / generate_image / generate_video) | `gateway.py` |
| `ProviderSelector` | 피처 → 프로바이더 매핑, 폴백 체인 결정 | `selector.py` |
| `ProviderRegistry` | DB 조회 + 30초 TTL 캐시 | `registry.py` |
| `HealthCache` | 프로바이더 헬스체크 결과 30초 캐시 | `health.py` |
| `CircuitBreaker` | 3회 연속 실패 시 60초 OPEN | `health.py` |
| `BaseAdapter` | 어댑터 ABC (chat/image/video 메서드) | `adapters/base.py` |
| `OpenAICompatAdapter` | Ollama/OpenAI/Gemini(compat)/Replicate 공통 | `adapters/openai_compat.py` |
| `AnthropicAdapter` | Claude 네이티브 API | `adapters/anthropic.py` |
| `DiffusersHTTPAdapter` | D:\SodamAI\image-service (Flux) | `adapters/diffusers_http.py` |
| `WanGPAdapter` | D:\Wan2GP HTTP API | `adapters/wangp_http.py` |
| `ComfyUIAdapter` | ComfyUI HTTP (HiDream 등) | `adapters/comfyui_http.py` |
| `RequestLogger` | ai_request_log 비동기 기록 | `logger.py` |

### 디렉토리 구조

```
SodamApp/backend/services/ai_gateway/
├── __init__.py           # get_gateway(), 공용 타입 re-export
├── gateway.py            # AIGateway 싱글톤
├── selector.py           # ProviderSelector + fallback 결정
├── registry.py           # ProviderRegistry (DB + 캐시)
├── health.py             # HealthCache + CircuitBreaker
├── logger.py             # ai_request_log writer
├── types.py              # Pydantic: ChatMessage, GenerationResult, etc.
├── errors.py             # AIGatewayError 계층
└── adapters/
    ├── __init__.py
    ├── base.py           # BaseAdapter ABC
    ├── openai_compat.py
    ├── anthropic.py
    ├── diffusers_http.py
    ├── wangp_http.py
    └── comfyui_http.py
```

---

## 2. 데이터 모델

### 2.1 새 테이블

#### `ai_provider`
```python
class AIProvider(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)          # "sodamai_ollama", "anthropic"
    display_name: str                                    # "셈하나 Ollama (로컬)"
    base_url: str | None = None                          # https URL or http://localhost:*
    auth_scheme: str = "none"                            # none | bearer | api_key_header | custom
    auth_env_var: str | None = None                      # "OPENAI_API_KEY" 등 — 값은 절대 DB에 저장 금지
    provider_kind: str                                    # openai_compat | anthropic | ollama
                                                          #  | diffusers_http | wangp_http | comfyui_http
    enabled: bool = True
    priority: int = 50                                    # 낮을수록 먼저 시도
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
```

#### `ai_model`
```python
class AIModel(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    provider_id: int = Field(foreign_key="aiprovider.id", index=True)
    model_id: str                                         # "gemma4:26b-a4b-q4_K_M", "claude-sonnet-4-6"
    display_name: str                                     # "Gemma 4 26B-A4B (로컬)"
    modality: str                                         # text | image | video | multimodal
    capabilities: str                                     # JSON: ["chat","vision","json_mode","tools"]
    input_modalities: str                                 # JSON: ["text","image"]
    context_length: int | None = None
    cost_per_1k_input: float | None = None                # USD, null이면 무료(self-hosted)
    cost_per_1k_output: float | None = None
    max_resolution: str | None = None                     # "1024x1024"
    enabled: bool = True
    priority_override: int | None = None                  # null이면 provider.priority 상속
    warmup_required: bool = False                         # True면 lazy load 감안
    created_at: datetime
    updated_at: datetime
```

#### `ai_request_log`
```python
class AIRequestLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    business_id: int | None = Field(default=None, index=True)
    feature: str = Field(index=True)                      # "ocr", "insights", "marketing_copy", "delivery_image"
    provider_id: int | None = None
    model_id: str | None = None                           # 선택된 실제 모델
    modality: str                                         # text | image | video
    requested_capabilities: str                           # JSON
    status: str                                            # success | fallback_success | failed | circuit_open
    error_message: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int | None = None
    cost_estimate: float | None = None
    fallback_chain: str | None = None                     # JSON: [{provider,model,status,error}]
    created_at: datetime = Field(default_factory=datetime.now, index=True)
```

### 2.2 GlobalSetting 확장 (기존 테이블 재사용)

피처별 기본 프로바이더는 `GlobalSetting`에 키-값으로 저장한다:

| key | value 예시 | 설명 |
|---|---|---|
| `ai.default_provider.ocr` | `sodamai_ollama:gemma4:26b-a4b-q4_K_M` | 영수증 OCR 기본 |
| `ai.default_provider.classify` | `sodamai_ollama:gemma4:e4b` | 거래처 분류 |
| `ai.default_provider.insights` | `anthropic:claude-sonnet-4-6` | 재무 인사이트 |
| `ai.default_provider.marketing_copy` | `anthropic:claude-sonnet-4-6` | 마케팅 카피 |
| `ai.default_provider.marketing_image` | `sodamai_flux:flux-1-schnell` | 마케팅 이미지 |
| `ai.default_provider.delivery_image` | `sodamai_flux:flux-1-schnell` | 배달앱 이미지 |
| `ai.default_provider.video` | `sodamai_wangp:wan2.2-ti2v-5b` | 비디오 생성 |
| `ai.fallback.max_attempts` | `3` | 캐스케이드 최대 시도 |
| `ai.circuit_breaker.failure_threshold` | `3` | Circuit open 임계값 |
| `ai.circuit_breaker.open_duration_sec` | `60` | Circuit open 유지 시간 |
| `ai.health_cache.ttl_sec` | `30` | 헬스체크 캐시 TTL |

**값 형식**: `{provider_name}:{model_id}` — 둘 다 DB의 ai_provider / ai_model과 매칭되어야 한다.

### 2.3 초기 시드 데이터 (8 provider / 13 model)

| Provider | Kind | Base URL | Priority | 설치 상태 |
|---|---|---|---|---|
| sodamai_ollama | openai_compat | http://localhost:11434/v1 | 10 | Phase 1에서 신규 설치 |
| sodamai_flux | diffusers_http | http://localhost:8100 | 10 | 기존 `D:\SodamAI\image-service` 재사용 |
| sodamai_wangp | wangp_http | http://localhost:7860 | 10 | 기존 `D:\Wan2GP` 재사용 |
| sodamai_comfyui | comfyui_http | http://localhost:8188 | 20 | 기존 ComfyUI (HiDream용) |
| anthropic | anthropic | https://api.anthropic.com | 50 | API 키만 필요 |
| openai | openai_compat | https://api.openai.com/v1 | 60 | 이미 `OPENAI_API_KEY` 존재 |
| google_gemini | openai_compat | https://generativelanguage.googleapis.com/v1beta/openai | 60 | 선택 |
| replicate | openai_compat | (custom) | 70 | 이미 `REPLICATE_API_TOKEN` 존재 |

**모델 시드 (13개)**:
- sodamai_ollama: `gemma4:e4b`, `gemma4:26b-a4b-q4_K_M`, `gemma4:31b-q4_K_M`
- sodamai_flux: `flux-1-schnell`
- sodamai_wangp: `wan2.2-ti2v-5b`, `wan2.2-t2v-a14b`, `wan2.2-i2v-a14b`
- sodamai_comfyui: `hidream-e1.1`
- anthropic: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`
- openai: `gpt-4o`, `gpt-4o-mini`

### 2.4 마이그레이션 전략

- Alembic 마이그레이션 1건으로 3개 테이블 생성
- 초기 시드는 별도 Python 스크립트 `scripts/seed_ai_gateway.py` — 멱등 실행 (`INSERT ... ON CONFLICT DO NOTHING`)
- GlobalSetting 키는 seed 스크립트가 기본값 미존재 시만 삽입

---

## 3. API Surface

### 3.1 Gateway 공개 API (Python 내부 호출)

```python
from services.ai_gateway import get_gateway, ChatMessage

gw = get_gateway()

# 1) 채팅/텍스트 (OCR, classify, insights, marketing_copy)
result = await gw.chat(
    feature="ocr",
    messages=[
        ChatMessage(role="system", content="..."),
        ChatMessage(role="user", content=[
            {"type": "text", "text": "이 영수증을 JSON으로 추출해"},
            {"type": "image_url", "image_url": {"url": "https://..."}},
        ]),
    ],
    response_format={"type": "json_object"},       # 선택
    required_capabilities=["vision", "json_mode"], # 선택
    business_id=42,                                 # 로깅용
)
# result.text / result.usage / result.provider_used / result.fallback_chain

# 2) 이미지 생성 (marketing_image, delivery_image)
result = await gw.generate_image(
    feature="delivery_image",
    prompt="떡볶이 메뉴 사진 스튜디오 조명...",
    width=1024, height=1024,
    init_image_url=None,                            # i2i 시 제공
    strength=0.7,                                    # i2i 강도
    business_id=42,
)
# result.image_url / result.provider_used

# 3) 비디오 생성 (video) — 비동기 Job 패턴
job = await gw.generate_video(
    feature="video",
    prompt="...",
    init_image_url="...",                           # i2v
    duration_sec=5,
    business_id=42,
)
# job.job_id → 이후 gw.get_job_status(job_id) 로 폴링
```

### 3.2 BaseAdapter 인터페이스

```python
class BaseAdapter(ABC):
    provider: AIProvider
    model: AIModel

    @abstractmethod
    async def health_check(self) -> bool: ...

    @abstractmethod
    async def chat(self, req: ChatRequest) -> ChatResult: ...

    async def generate_image(self, req: ImageRequest) -> ImageResult:
        raise NotSupportedError(...)

    async def generate_video(self, req: VideoRequest) -> VideoJob:
        raise NotSupportedError(...)

    async def get_job(self, job_id: str) -> VideoJob:
        raise NotSupportedError(...)
```

- 어댑터는 자신이 지원하지 않는 modality는 `NotSupportedError`를 던진다
- Selector는 이 오류를 **폴백 트리거**로 해석한다

### 3.3 에러 계층

```python
class AIGatewayError(Exception): ...
class NoProviderAvailableError(AIGatewayError): ...   # 모든 프로바이더가 circuit open
class NotSupportedError(AIGatewayError): ...          # 어댑터 기능 미지원
class AuthenticationError(AIGatewayError): ...        # 401/403 — 폴백 트리거
class RateLimitError(AIGatewayError): ...             # 429 — 잠시 대기 후 폴백
class UpstreamTimeoutError(AIGatewayError): ...       # 폴백 트리거
class UpstreamServerError(AIGatewayError): ...        # 5xx — 폴백 트리거
class InvalidRequestError(AIGatewayError): ...        # 400 — 폴백 안 함
```

### 3.4 관리자 HTTP 라우트 (11개)

기존 `routers/settings.py` 패턴을 따라 **SuperAdmin 전용** 신규 라우터 `routers/ai_gateway_admin.py` 생성:

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/admin/ai/providers` | 프로바이더 목록 |
| POST | `/api/admin/ai/providers` | 프로바이더 추가 |
| PUT | `/api/admin/ai/providers/{id}` | 수정 (enabled/priority/base_url 등) |
| DELETE | `/api/admin/ai/providers/{id}` | 삭제 (연결된 model은 cascade) |
| GET | `/api/admin/ai/providers/{id}/health` | 즉시 헬스체크 (캐시 우회) |
| GET | `/api/admin/ai/models` | 모델 목록 (filter: provider_id, modality) |
| POST | `/api/admin/ai/models` | 모델 추가 |
| PUT | `/api/admin/ai/models/{id}` | 수정 |
| GET | `/api/admin/ai/features` | 피처별 기본 프로바이더 매핑 조회 |
| PUT | `/api/admin/ai/features/{feature}` | 피처별 기본 프로바이더 변경 |
| GET | `/api/admin/ai/logs` | 요청 로그 (filter: feature, status, business_id, 날짜) |
| POST | `/api/admin/ai/playground` | 임시 호출 테스트 (provider+model 직접 지정) |

**주의**: 라우트는 모두 SuperAdmin RBAC로만 접근 가능. `auth_env_var`의 실제 값은 절대 응답에 포함하지 않음 (값 존재 여부만 반환).

---

## 4. SuperAdmin Settings UI

### 4.1 메뉴 구조

기존 프론트엔드 `SuperAdminDashboard` 하위에 **"AI Gateway"** 섹션 추가:

```
⚙️ 시스템 관리
├── 📊 대시보드
├── 🤖 AI Gateway                ← 신규
│   ├── 개요 (Dashboard)
│   ├── 프로바이더
│   ├── 모델
│   ├── 피처 매핑
│   ├── 요청 로그
│   └── Playground
```

### 4.2 화면별 설계

#### A) 개요 대시보드
- **상태 카드 8개** (프로바이더별): 이름, enabled, 최근 헬스체크, Circuit 상태 (CLOSED/OPEN/HALF_OPEN), 24h 요청수, 성공률
- **피처별 현재 기본 모델** 미니 표 (7개)
- **24h 요청량 차트** (피처별 스택 바)
- **24h 폴백 발생 건수** (경고 레벨)

#### B) 프로바이더 목록
- 테이블: 이름, kind, base_url, enabled, priority, 상태
- "헬스체크" 버튼 (개별/일괄)
- "+ 추가" → 모달

#### C) 프로바이더 상세
- 편집 폼: display_name, base_url, auth_scheme, auth_env_var, priority, enabled, notes
- `auth_env_var` 필드는 **값 자체가 아니라 환경변수 이름**임을 명시 (힌트 텍스트)
- "이 프로바이더의 모델" 섹션 (하단 리스트)

#### D) 모델 목록
- 필터: 프로바이더, modality
- 테이블: display_name, provider, modality, capabilities (태그), enabled, 우선순위
- "+ 추가" → 모달

#### E) 피처 매핑
- 7개 피처 각각에 대해 **드롭다운** (현재 활성화된 모델만 노출)
- 저장 시 GlobalSetting 업데이트
- "기본값 복원" 버튼

#### F) 요청 로그
- 필터: 날짜 범위, feature, status, business_id
- 테이블: 시간, business, feature, provider → model, status, latency, tokens, cost
- Row 클릭 시 상세 모달 (fallback_chain JSON, error_message)

#### G) Playground
- 프로바이더 + 모델 선택
- 메시지 입력 (text/image 업로드)
- "호출" → 결과 + latency + 원시 응답
- 설정 변경 전 **사전 검증**용

### 4.3 공통 UX 원칙

- Slate/Blue 팔레트 (CLAUDE.md 디자인 시스템 준수)
- 모든 쓰기 작업은 **확인 다이얼로그**
- Circuit OPEN 상태는 **빨간 배지**로 즉시 식별 가능
- 저장 후 **낙관적 업데이트** + 실패 시 롤백

---

## 5. Fallback & Health Checks

### 5.1 Selector 알고리즘

```
def select(feature, required_caps, modality):
    chain = []

    # 1) 피처 기본 프로바이더
    primary = get_global_setting(f"ai.default_provider.{feature}")
    if primary:
        chain.append(resolve(primary))

    # 2) 나머지: enabled + modality + caps 만족 + priority 순
    candidates = registry.list(
        enabled=True,
        modality=modality,
        capabilities_include=required_caps,
    )
    for c in candidates:
        if c not in chain:
            chain.append(c)

    return chain[:MAX_ATTEMPTS]   # 기본 3
```

### 5.2 Cascading Fallback (최대 3회)

```
for idx, (provider, model) in enumerate(chain):
    if circuit.is_open(provider):
        record(status="circuit_open"); continue
    if not health.check(provider):       # 30s 캐시
        record(status="unhealthy"); continue
    try:
        result = await adapter.call(...)
        log.success(chain=..., used_idx=idx)
        return result
    except (AuthenticationError, RateLimitError,
            UpstreamTimeoutError, UpstreamServerError) as e:
        circuit.record_failure(provider)
        chain_log.append({provider, model, status:"failed", error:str(e)})
        continue
    except InvalidRequestError:
        # 폴백해도 동일 실패 → 즉시 raise
        raise

raise NoProviderAvailableError(chain_log)
```

### 5.3 Health Cache

- **TTL**: 30초 (GlobalSetting `ai.health_cache.ttl_sec`)
- **검사 방법**:
  - openai_compat / anthropic: `GET {base_url}/models` 또는 `POST /v1/chat/completions` with 1-token ping
  - diffusers_http / wangp_http / comfyui_http: `GET /health` 또는 `GET /` — 어댑터별 구현
  - TCP-level reachability 먼저 확인 (기존 `delivery_images.py` 패턴 재사용)
- **실패 시**: unhealthy 마킹, 다음 30초간 해당 프로바이더 skip
- **강제 새로 고침**: 관리자 UI "헬스체크" 버튼은 캐시 우회

### 5.4 Circuit Breaker

| 상태 | 조건 | 동작 |
|---|---|---|
| CLOSED | 기본 | 요청 허용 |
| OPEN | 연속 실패 ≥ 3회 | 60초간 요청 차단, 즉시 폴백 |
| HALF_OPEN | OPEN 60초 경과 | 다음 1회 요청만 허용, 성공 시 CLOSED, 실패 시 다시 OPEN |

- **메모리 상태** (프로세스 로컬) — multi-worker 시 각 워커별 독립
- Phase 2에서 Redis 공유로 확장 고려

### 5.5 Retry 정책

- **어댑터 내부 재시도**: 동일 프로바이더로 **재시도하지 않음** (즉시 폴백)
- **단, 429 (RateLimit)**는 `Retry-After` 헤더 존중 후 최대 1회 재시도 가능 (구현 단순성을 위해 Phase 1에서는 **즉시 폴백**)
- **타임아웃**: chat 60s, image 120s, video = 즉시 job ID 반환 (폴링)

### 5.6 Graceful Degradation

각 피처는 **전체 폴백 실패** 시 기능별 기본 동작:

| Feature | 전체 실패 시 |
|---|---|
| ocr | 사용자에게 "자동 인식 실패, 수동 입력" 메시지 |
| classify | smart_classifier.py의 규칙 기반 결과만 사용 |
| insights | "AI 분석을 일시적으로 사용할 수 없습니다" |
| marketing_copy | 템플릿 기반 기본 문구 |
| marketing_image | placeholder 이미지 |
| delivery_image | 기존 Replicate 직접 호출 경로 유지 (하위 호환) |
| video | 사용자에게 job 실패 알림 |

---

## 6. Migration Path (로컬 → 클라우드 GPU 200GB+)

### 6.1 5대 이식성 원칙

1. **URL은 환경변수로만**: 코드에 localhost/IP 하드코딩 금지. DB의 `base_url`도 `${ENV_VAR}` 치환 지원
2. **모델명은 DB 레지스트리로만**: 코드에 모델 ID 하드코딩 금지
3. **OpenAI-Compatible 프로토콜 표준화**: 이전 시 어댑터 교체 없이 base_url만 변경
4. **Capability 기반 피처 매핑**: 특정 모델이 아닌 capability로 선택 → 모델 교체가 피처에 영향 없음
5. **Graceful Degradation**: 이전 중 일부 프로바이더 단절되어도 서비스 유지

### 6.2 사용자 선행 작업 (Phase 1 구현 전 병행)

| Step | 작업 | 검증 |
|---|---|---|
| 1 | 2번째 RTX 3090 설치 (보조 슬롯), 드라이버 확인, 모니터는 GPU 0에만 연결 | `nvidia-smi` 2개 표시 |
| 2 | 환경변수 선(先)설정: `HF_HOME=D:\SodamAI\models\huggingface`, `HF_HUB_CACHE=D:\SodamAI\models\huggingface\hub`, `OLLAMA_MODELS=D:\SodamAI\models\ollama`, `TRANSFORMERS_CACHE=D:\SodamAI\models\huggingface\hub` | 시스템 환경변수 창 |
| 3 | `C:\Users\choon\.cache\huggingface` → `D:\SodamAI\models\huggingface`로 robocopy /MOVE (~50GB) | D:\ 확인, C:\ 여유 |
| 4 | Ollama 설치 (환경변수 설정 **후**) | `ollama list` 동작 |
| 5 | `CUDA_VISIBLE_DEVICES=1` (Ollama 서비스용) 설정 — GPU 1에 고정 | Ollama 실행 시 GPU 1만 사용 |
| 6 | `ollama pull gemma4:e4b` → 이후 `ollama pull gemma4:26b-a4b-q4_K_M` (실제 태그명은 Ollama 레지스트리 조회 후 확정) | 모델 파일이 D:\에 생성 |
| 7 | Cloudflare Tunnel (기존 twinverseDesk) ingress에 `ai-llm.twinverse.org → localhost:11434` 추가 + Cloudflare Access 보호 | HTTPS 접근 확인 |

> **주의**: Phase 1에서는 **로컬 localhost**로 시작한다. Cloudflare Tunnel은 나중에 클라우드 이전 준비용으로 미리 세팅하되, Phase 1 백엔드는 localhost:11434 우선.
> **Gemma 4 모델 태그**는 Ollama 레지스트리에 실제 등록된 태그를 확인 후 사용 (위 태그는 예시, 설치 시점에 `ollama pull gemma4:...` 또는 `gemma3:...` 중 실제 등록된 이름 사용).

### 6.3 클라우드 이전 플레이북 (Phase 1 완료 후)

#### Step A: 이전 대상 식별
- 어떤 프로바이더가 self-hosted인가? → `ai_provider` 테이블에서 `base_url LIKE 'http://localhost%'`

#### Step B: 클라우드 GPU 서버 준비
- GPU 200GB+ VRAM (예: A100 80GB ×3, H100 80GB ×3)
- Ollama / Flux / WanGP / ComfyUI 각각 설치
- 각 서비스의 엔드포인트를 내부 DNS 또는 고정 IP로 노출

#### Step C: DNS 준비
- `ollama-prod.twinverse.org`, `flux-prod.twinverse.org`, `wangp-prod.twinverse.org`, `comfyui-prod.twinverse.org`
- Cloudflare Access로 백엔드만 접근 가능하게 제한

#### Step D: 데이터 이전
- 모델 파일은 각 서비스 설치 시 다시 다운로드 (로컬 → 클라우드 직접 복사는 비효율)
- `ai_provider`, `ai_model`, GlobalSetting은 PostgreSQL dump/restore로 이전 (이미 Orbitron 배포 시 자동 이전)

#### Step E: 전환 (무중단)
1. **이중 등록**: 신규 cloud 프로바이더를 DB에 추가 (`sodamai_ollama_cloud` 등), 초기 `enabled=false`
2. 각 cloud 프로바이더 헬스체크 통과 확인
3. **Playground**에서 수동 호출 테스트
4. 해당 프로바이더 `enabled=true` + `priority=5` (로컬보다 낮은 숫자)로 승격
5. 24h 모니터링: `ai_request_log`에서 cloud 프로바이더 성공률 확인
6. 문제 없으면 **로컬 프로바이더 `enabled=false`**
7. 7일 후 로컬 서비스 물리 종료

#### Step F: 롤백 절차
- 문제 발생 시 cloud 프로바이더 `enabled=false` → 로컬 자동 복귀 (Selector가 우선순위로 로컬 선택)
- DB 롤백은 불필요 (이중 등록 상태 유지)

### 6.4 비용 보호

- `ai_model.cost_per_1k_input/output` 기록 필수
- `ai_request_log.cost_estimate` 누적 합산 → 관리자 대시보드에 일/주/월 표시
- Phase 2에서 **월 비용 상한** 알람 추가 예정

### 6.5 5대 이전 검증 체크리스트

이전 완료 선언 전 반드시 확인:

- [ ] 코드 검색 `grep -r "localhost:" backend/services/ai_gateway/` → 0건
- [ ] 코드 검색 `grep -r "gemma" backend/` (ai_gateway 외) → 0건 (모델 ID 하드코딩 없음)
- [ ] 모든 프로바이더 URL이 env var 또는 DB 값임
- [ ] Playground에서 7개 피처 × 신규 프로바이더 각 1회 성공
- [ ] 이전 7일 로그에서 성공률 > 99%

---

## 7. 테스트 전략

### 7.1 단위 테스트
- 각 Adapter: mock HTTP 서버로 chat/image/video 호출 검증
- ProviderRegistry: 캐시 TTL, 무효화
- CircuitBreaker: CLOSED→OPEN→HALF_OPEN 전이
- Selector: priority 정렬, capability 필터링, fallback chain 생성

### 7.2 통합 테스트
- `pytest-asyncio` + 실제 Ollama (설치 후) + mock Anthropic/OpenAI
- 피처별 end-to-end: OCR → ChatRequest → Adapter → mock response → 기능 코드에서 파싱

### 7.3 수동 검증
- Playground에서 각 프로바이더 핸드셰이크
- Circuit Breaker 강제 트리거 (프로바이더 일시 중지 → 3회 실패 유도)
- 피처 매핑 변경 후 즉시 반영 확인

---

## 8. 보안 고려사항

1. **API 키**: 절대 DB에 저장 금지. `auth_env_var` 필드에는 **환경변수 이름**만 저장
2. **관리자 라우트**: SuperAdmin RBAC 필수 (`require_superadmin` 디펜던시)
3. **Playground**: 입력 프롬프트를 요청 로그에 저장하지 않음 (옵션, 기본 OFF)
4. **외부 URL**: `init_image_url` 등 외부 URL은 SSRF 방지를 위해 스킴 whitelist (`https`)
5. **로그 masking**: `ai_request_log.error_message`에서 API 키 패턴 자동 마스킹
6. **Cloudflare Access**: ai-llm 엔드포인트는 Cloudflare Access로 보호, 백엔드 서비스 JWT 검증

---

## 9. 배포 체크리스트

### Orbitron.yaml 환경변수 추가

#### backend env
```yaml
OLLAMA_BASE_URL: "${OLLAMA_BASE_URL}"              # 예: http://localhost:11434/v1
ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"          # secret
OPENAI_API_KEY: "${OPENAI_API_KEY}"                # secret (기존)
GOOGLE_API_KEY: "${GOOGLE_API_KEY}"                # secret (선택)
REPLICATE_API_TOKEN: "${REPLICATE_API_TOKEN}"      # secret (기존)
AI_FLUX_BASE_URL: "${AI_FLUX_BASE_URL}"            # 기존 AI_GPU_SERVER_URL 대체
AI_WANGP_BASE_URL: "${AI_WANGP_BASE_URL}"
AI_COMFYUI_BASE_URL: "${AI_COMFYUI_BASE_URL}"
```

#### Orbitron secrets
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `REPLICATE_API_TOKEN`

### 작업 완료 시 사용자 보고 (CLAUDE.md 규칙)
```
⚠️ 배포 환경변수 체크:
- [ ] Orbitron.yaml backend env 업데이트 완료
- [ ] Orbitron secrets: ANTHROPIC_API_KEY, GOOGLE_API_KEY 설정 필요
- [ ] frontend/postDeploy env 변경 없음 (이번 Phase는 admin UI만)
```

---

## 10. 오픈 이슈 / Phase 2 후보

- **스트리밍 응답 (SSE)**: chat 응답 스트리밍은 Phase 2
- **Tool Use / Function Calling**: capability로만 선언, 실제 사용은 Phase 2
- **임베딩 서비스**: 별도 진입점 (`gw.embed()`) Phase 2
- **멀티 테넌트 쿼터**: 비즈니스별 월 비용 상한 Phase 2
- **Redis 기반 Circuit Breaker 공유**: 멀티 워커 환경 Phase 2
- **관측성**: Prometheus metrics / Grafana 대시보드 Phase 2

---

## 11. 구현 순서 (개략)

1. DB 마이그레이션 (3개 테이블) + seed 스크립트
2. `services/ai_gateway/types.py` + `errors.py`
3. `BaseAdapter` + `OpenAICompatAdapter` (Ollama 대상 최소 구현)
4. `ProviderRegistry` + `HealthCache` + `CircuitBreaker`
5. `ProviderSelector` + `AIGateway.chat()`
6. `AnthropicAdapter`
7. `DiffusersHTTPAdapter` + `AIGateway.generate_image()`
8. `WanGPAdapter` + `AIGateway.generate_video()` + Job 폴링
9. `ComfyUIAdapter`
10. `RequestLogger` + `ai_request_log` 기록
11. 관리자 라우트 (11개)
12. 관리자 프론트엔드 7개 화면
13. 기존 피처 코드 마이그레이션 (delivery_images, ocr, insights, 등)
14. E2E 테스트 + Playground 검증
15. 문서 업데이트

> 세부 순서와 각 단계 테스트는 **writing-plans** 단계에서 확정된다.

---

**끝.**
