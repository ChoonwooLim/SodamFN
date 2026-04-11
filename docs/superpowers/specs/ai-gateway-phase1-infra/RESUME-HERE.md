# AI Gateway Phase 1 — Session Resume Point

**작성일**: 2026-04-11
**다음 세션 시작 시 이 문서를 제일 먼저 읽어주세요.**

---

## TL;DR (한 줄 요약)

인프라 준비 100% 완료 → **다음 작업: `writing-plans` 스킬로 Phase 1 백엔드 구현 플랜 작성**
(전제 조건: 두 번째 RTX 3090 물리 장착 완료 후 `post-gpu-verify.ps1` 실행하여 검증)

---

## 1. 지금까지 완료된 것 (2026-04-11 세션)

### 1-1. HuggingFace 캐시 이전 (C: → D:)
- **원본**: `C:\Users\choon\.cache\huggingface`
- **이전 완료**: `D:\SodamAI\models\huggingface` (**81.33 GB**, 72 files, 0 failures)
- 방법: robocopy `/COPY:DAT /DCOPY:DAT /MT:16` (원본 보존 복사)
- 로그: [migrate-hf-cache.log](./migrate-hf-cache.log)

### 1-2. Ollama 모델 이전 (Junction 방식)
- **물리 위치**: `D:\SodamAI\models\ollama` (**47.36 GB**)
- **논리 경로**: `C:\Users\choon\.ollama\models` (Junction → D:)
- 이유: Ollama serve가 실행 중일 때 env var를 안 읽어서, Junction으로 강제 리다이렉트
- 구버전 백업 폴더 `.ollama\models_backup_20260411`는 Phase A에서 삭제 완료

**설치된 모델 목록** (새 세션에서도 동일하게 보여야 정상):
```
gpt-oss:20b            13.79 GB
gemma4:e4b              9.61 GB  ← Phase 1 주력 모델
qwen2.5:0.5b            0.40 GB
gemma2:9b               5.44 GB
qwen2.5:7b              4.68 GB
llama3.2-vision:11b     7.82 GB
mistral:7b              4.37 GB
llava:7b                4.73 GB
```

### 1-3. 시스템 환경변수 4개 설정 완료 (`setx /M`)
```
HF_HOME            = D:\SodamAI\models\huggingface
HF_HUB_CACHE       = D:\SodamAI\models\huggingface\hub
TRANSFORMERS_CACHE = D:\SodamAI\models\huggingface\hub
OLLAMA_MODELS      = D:\SodamAI\models\ollama
```
- 롤백 스크립트: [rollback-env-vars.bat](./rollback-env-vars.bat)

### 1-4. Gemma 4 모델 검증 완료
- 엔드포인트: `http://localhost:11434/api/generate`
- 모델명: `gemma4:e4b` (9.6 GB)
- **성능**: RTX 3090 1장 기준 **120+ tok/s**
- **한국어 정상 작동 확인**: "안녕하세요! 저는 사용자님의 질문에 답하고... 계산 결과는 **3**입니다"
- 테스트 파일: [test-prompt.json](./test-prompt.json)

### 1-5. C: 드라이브 대청소 (3 Phase, +210.11 GB 확보)

| 단계 | 작업 | 확보 | 누적 Free |
|---|---|---|---|
| 시작 | — | — | 591.42 GB |
| **Phase A** (삭제) | .cache\huggingface, Ollama 백업, Temp, 휴지통 | +89.42 GB | 680.84 GB |
| **Phase B** (D: 이전 + Junction) | Movies, generative-models, Downloads | +55.27 GB | 736.11 GB |
| **Phase C** (캐시 삭제) | pip, CapCut 캐시, npm-cache, NVIDIA DXCache, CapCut 구버전 | +65.44 GB | **801.53 GB** |

**제외된 항목** (사용자 지시):
- UnrealEngine Zen ~51 GB (엔진 재빌드 비용)
- Google DriveFS ~6 GB (재동기화 비용)

### 1-6. Junction 4개 (모두 D: 리다이렉트)
```
C:\Users\choon\.ollama\models      → D:\SodamAI\models\ollama
C:\Movies                          → D:\Movies
C:\Users\choon\generative-models   → D:\SodamAI\generative-models
C:\Users\choon\Downloads           → D:\UserData\Downloads
```

---

## 2. 하드웨어 변경 작업 (사용자 직접)

**작업**: 두 번째 RTX 3090 물리 장착
- 파워 케이블 (8-pin × 2), PCIe 슬롯 장착
- 케이스 에어플로우 확인
- 부팅 후 GPU 2장 인식 여부를 `post-gpu-verify.ps1`로 검증

**참고**:
- 현재 드라이버: 591.44
- 두 번째 카드 장착 시 드라이버는 자동 인식됨 (같은 모델)
- Ollama 멀티 GPU 활용: `OLLAMA_NUM_GPU` 또는 기본 자동 분산

---

## 3. 새 세션에서 제일 먼저 할 일

### Step 1. 이 문서 읽기
```
Read: c:\WORK\SodamFN\docs\superpowers\specs\ai-gateway-phase1-infra\RESUME-HERE.md
```

### Step 2. 환경 검증 스크립트 실행
```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "c:\WORK\SodamFN\docs\superpowers\specs\ai-gateway-phase1-infra\post-gpu-verify.ps1"
```
이 스크립트가 아래를 모두 자동 검증:
- GPU 2장 인식 여부 (RTX 3090 × 2)
- 시스템 환경변수 4개 (HF_HOME 등)
- Junction 4개 상태
- Ollama 서비스 가용성
- `gemma4:e4b` 모델 로드 및 추론 테스트 (한국어)
- D: 드라이브 SodamAI 구조

모든 체크가 "OK"로 나오면 즉시 Step 3 진행 가능.

### Step 3. Phase 1 백엔드 구현 플랜 작성
`writing-plans` 스킬 invoke → 아래 체크리스트 기반으로 구현 플랜 작성

---

## 4. Phase 1 백엔드 구현 범위 (writing-plans 입력 자료)

### 4-1. 목표
셈하나 백엔드에서 **AI Gateway 엔드포인트** (`/v1/ai-gateway/*`) 제공. 로컬 LLM (Ollama, gemma4:e4b 주력)을 셈하나 FastAPI 백엔드가 프록시하여 관리자/직원 앱에서 호출 가능하게 함.

### 4-2. 주요 구성요소

1. **Gateway 라우터** (`backend/routers/ai_gateway.py`)
   - `POST /v1/ai-gateway/chat` — 일반 텍스트 생성 (gemma4:e4b)
   - `POST /v1/ai-gateway/embed` — 임베딩 (모델 선정 필요)
   - `GET /v1/ai-gateway/models` — 가용 모델 리스트
   - `GET /v1/ai-gateway/health` — Ollama 헬스체크

2. **Ollama 클라이언트 서비스** (`backend/services/ollama_service.py`)
   - Base URL: 환경변수 `AI_GATEWAY_OLLAMA_URL` (기본 `http://localhost:11434`)
   - 스트리밍 지원 (`stream=True` → SSE)
   - 타임아웃, 재시도 정책

3. **사용량 집계/로깅** (`backend/models/ai_gateway_log.py`)
   - 요청자, 모델명, input/output 토큰, latency, cost(무료지만 향후 확장), error 여부
   - RBAC: admin/staff 구분

4. **RBAC 통합**
   - 기존 JWT 인증 재사용
   - 역할별 모델/quota 제한 (차후 확장)

5. **환경변수 4곳 동기화** (CLAUDE.md 원칙 — 필수)
   - `backend/.env`
   - `Orbitron.yaml` → backend env
   - `Orbitron.yaml` → frontend env (VITE_AI_GATEWAY_URL 등)
   - `Orbitron.yaml` → postDeploy env
   - 신규 변수 후보: `AI_GATEWAY_OLLAMA_URL`, `AI_GATEWAY_DEFAULT_MODEL`, `AI_GATEWAY_MAX_TOKENS`

6. **Cloudflare Tunnel 라우트** (사용자 직접)
   - twinverseDesk 프로젝트에서 `/v1/ai-gateway/*` → 로컬 Windows 머신 라우팅
   - **이 건은 사용자 액션**, 백엔드 코드와 무관

### 4-3. 아직 결정 안 된 것 (writing-plans 단계에서 사용자와 상의 필요)
- [ ] 임베딩 모델 선정 (gemma 계열? 별도 모델 설치?)
- [ ] 스트리밍 응답 우선도 (초기에는 non-stream만 지원할지)
- [ ] 요청 로깅 저장 위치 (기존 PostgreSQL에 테이블 추가)
- [ ] Rate limit 정책
- [ ] 프론트엔드 통합 범위 (관리자만? staff-app도?)

---

## 5. 사용자 측 펜딩 작업 목록 (Claude가 할 수 없는 것)

1. **두 번째 RTX 3090 물리 장착** ← 이 세션 종료 후 바로
2. **Cloudflare Tunnel 설정**: twinverseDesk 프로젝트에 `/v1/ai-gateway/*` 라우트 추가
3. **Orbitron secrets 등록**: Phase 1 구현 완료 후 새 환경변수 등록

---

## 6. 주요 Gotcha (새 세션 Claude가 반드시 알아야 할 것)

### 6-1. PowerShell 스크립트는 반드시 파일로 작성
- Bash 경유 `powershell.exe -Command "... $_ ..."`는 bash가 `$_`를 먹어버림
- **규칙**: 항상 `Write` 툴로 `.ps1` 파일 생성 → `powershell.exe -File` 호출

### 6-2. 한국어 프롬프트는 UTF-8 JSON 파일 경유
- PowerShell 5.1 on 한국어 Windows는 `.ps1`을 CP949로 읽어 한국어 문자열 깨짐
- **규칙**: 한국어 페이로드는 `test-prompt.json` 같은 UTF-8 파일로 저장 후 `Get-Content -Raw -Encoding UTF8` + `[System.Text.Encoding]::UTF8.GetBytes()`

### 6-3. Junction은 투명하지만 삭제 시 주의
- Junction을 `Remove-Item -Recurse`하면 타겟(D:\) 원본까지 삭제될 수 있음
- 삭제가 필요하면 반드시 `fsutil reparsepoint delete` 또는 `rmdir`(cmd) 사용

### 6-4. Ollama serve 프로세스 환경 분리
- setx는 새 프로세스에만 적용. 이미 실행 중인 Ollama serve는 구 env 유지
- 새 세션에서 Ollama 재시작이 필요하면 `taskkill /IM ollama.exe /F` 후 재시작

### 6-5. CLAUDE.md 환경변수 4곳 동기화 원칙
- 신규 env var 추가 시 `.env` + `Orbitron.yaml`의 backend/frontend/postDeploy 모두 업데이트
- 빈 값(`""`)으로 Orbitron.yaml 방치 금지 — 배포 장애 유발

---

## 7. 참고 문서

| 문서 | 용도 |
|---|---|
| [01-migration-plan.md](./01-migration-plan.md) | 초기 마이그레이션 계획 |
| [04-verification.md](./04-verification.md) | 검증 체크리스트 |
| [phase-c-verify.ps1](./phase-c-verify.ps1) | 현재 상태 빠른 재검증 |
| [post-gpu-verify.ps1](./post-gpu-verify.ps1) | **새 세션 첫 실행 스크립트** (GPU 2장 + 전체 상태) |

---

## 8. 현재 Git 상태

- `docs/superpowers/specs/ai-gateway-phase1-infra/` 폴더 전체 Untracked
- **이 문서 작성 직후 전체 커밋 예정**
- 커밋 메시지: `infra: AI Gateway Phase 1 인프라 준비 완료 (HF/Ollama D: 이전 + C: 드라이브 정리 +210 GB)`
