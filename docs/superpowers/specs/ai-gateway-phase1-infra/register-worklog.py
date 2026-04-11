"""
Register DevWorkLog entry for 2026-04-11 session:
AI Gateway Phase 1 infrastructure preparation.
"""
import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')

from datetime import date, datetime
from sqlmodel import Session, select
from database import engine
from models import DevWorkLog

TITLE = "AI Gateway Phase 1 인프라 준비 + C: 드라이브 대청소"
TODAY = date(2026, 4, 11)

CONTENT = """## AI Gateway Phase 1 - 인프라 준비 완료

### 1. HuggingFace 캐시 D: 이전
- 원본: `C:\\Users\\choon\\.cache\\huggingface`
- 대상: `D:\\SodamAI\\models\\huggingface` (81.33 GB, 72 files)
- 방법: robocopy `/COPY:DAT /DCOPY:DAT /MT:16` (원본 보존)

### 2. Ollama 모델 D: 이전 (Junction 방식)
- 물리: `D:\\SodamAI\\models\\ollama` (47.36 GB)
- 논리: `C:\\Users\\choon\\.ollama\\models` → Junction
- 이유: Ollama serve 프로세스가 env var 무시하고 구경로 사용 → Junction으로 강제 리다이렉트
- 모델 8개: gpt-oss:20b, **gemma4:e4b**, qwen2.5:0.5b/7b, gemma2:9b, llama3.2-vision:11b, mistral:7b, llava:7b

### 3. 시스템 환경변수 4개 설정 (setx /M)
- HF_HOME, HF_HUB_CACHE, TRANSFORMERS_CACHE, OLLAMA_MODELS
- 롤백 스크립트: rollback-env-vars.bat

### 4. Gemma 4 검증
- 엔드포인트: http://localhost:11434/api/generate
- 모델: gemma4:e4b (9.6 GB)
- 성능: **126.6 tok/s** (RTX 3090 1장)
- 한국어 정상 작동 확인 ("1+2=3", 자기소개)

### 5. C: 드라이브 대청소 (+210.11 GB)
| 단계 | 작업 | 확보 | 누적 Free |
|---|---|---|---|
| 시작 | — | — | 591.42 GB |
| Phase A (삭제) | .cache/huggingface, Ollama 백업, Temp, 휴지통 | +89.42 | 680.84 |
| Phase B (D: 이전+Junction) | Movies, generative-models, Downloads | +55.27 | 736.11 |
| Phase C (캐시 삭제) | pip, CapCut 캐시, npm-cache, NVIDIA DXCache, CapCut 구버전 | +65.44 | **801.53** |

**제외**: UnrealEngine Zen (~51GB), Google DriveFS (~6GB) — 재빌드/재동기화 비용 회피

### 6. Junction 4개 (모두 D: 리다이렉트)
- C:\\Users\\choon\\.ollama\\models → D:\\SodamAI\\models\\ollama
- C:\\Movies → D:\\Movies
- C:\\Users\\choon\\generative-models → D:\\SodamAI\\generative-models
- C:\\Users\\choon\\Downloads → D:\\UserData\\Downloads

### 7. 세션 Handoff 문서
- **RESUME-HERE.md** — 새 세션 첫 읽기 파일
- **post-gpu-verify.ps1** — GPU 2장 장착 후 자동 검증 스크립트 (7개 카테고리, 18 체크)

---

**다음 세션 첫 작업**:
1. 사용자가 2번째 RTX 3090 물리 장착 + 부팅
2. `post-gpu-verify.ps1` 실행 → 18개 체크 모두 OK 확인
3. `writing-plans` 스킬 invoke → Phase 1 백엔드 구현 플랜 작성
"""

AI_SUMMARY = """[AI Gateway Phase 1 인프라 준비 완료 - 2026-04-11]

**현재 상태**: 인프라 100% 준비, 다음은 백엔드 구현 플랜 작성 단계
**핵심 파일**: docs/superpowers/specs/ai-gateway-phase1-infra/RESUME-HERE.md (새 세션에서 제일 먼저 읽기)

**완료 항목**:
- HF 캐시 81.33 GB → D:\\SodamAI\\models\\huggingface
- Ollama 47.36 GB → D:\\SodamAI\\models\\ollama (Junction)
- Env vars 4개 설정 (HF_HOME, HF_HUB_CACHE, TRANSFORMERS_CACHE, OLLAMA_MODELS)
- Gemma 4 (gemma4:e4b) 검증 완료, 126.6 tok/s, 한국어 OK
- C: 드라이브 +210 GB 확보 (801.53 GB free)
- Junction 4개 (Ollama/Movies/generative-models/Downloads → D:)

**새 세션 작업 순서**:
1. RESUME-HERE.md 읽기
2. post-gpu-verify.ps1 실행 (GPU 2장 감지 + 전체 상태 검증)
3. writing-plans 스킬로 Phase 1 백엔드 구현 플랜 작성

**주의**:
- PowerShell 스크립트는 Write 툴로 .ps1 파일 저장 후 실행 (bash가 $_ 먹음)
- 한국어 프롬프트는 UTF-8 JSON 파일 경유 (PS 5.1 CP949 깨짐)
- Junction 삭제 시 반드시 fsutil reparsepoint delete 사용 (Remove-Item은 타겟까지 삭제)
- 새 env var 추가 시 .env + Orbitron.yaml (backend/frontend/postDeploy) 4곳 동기화
"""

FILES_CHANGED = """docs/superpowers/specs/ai-gateway-phase1-infra/01-migration-plan.md
docs/superpowers/specs/ai-gateway-phase1-infra/02-migrate-hf-cache.bat
docs/superpowers/specs/ai-gateway-phase1-infra/03-set-env-vars.bat
docs/superpowers/specs/ai-gateway-phase1-infra/04-verification.md
docs/superpowers/specs/ai-gateway-phase1-infra/phase-a-execute.ps1
docs/superpowers/specs/ai-gateway-phase1-infra/phase-b-execute.ps1
docs/superpowers/specs/ai-gateway-phase1-infra/phase-c-execute.ps1
docs/superpowers/specs/ai-gateway-phase1-infra/phase-c-verify.ps1
docs/superpowers/specs/ai-gateway-phase1-infra/post-gpu-verify.ps1
docs/superpowers/specs/ai-gateway-phase1-infra/RESUME-HERE.md
docs/superpowers/specs/ai-gateway-phase1-infra/rollback-env-vars.bat
docs/superpowers/specs/ai-gateway-phase1-infra/test-prompt.json"""

with Session(engine) as session:
    existing = session.exec(
        select(DevWorkLog).where(
            DevWorkLog.date == TODAY,
            DevWorkLog.title == TITLE,
        )
    ).first()
    if existing:
        print(f"[SKIP] Already exists: id={existing.id}")
    else:
        entry = DevWorkLog(
            date=TODAY,
            title=TITLE,
            content=CONTENT,
            category="infra",
            files_changed=FILES_CHANGED,
            ai_summary=AI_SUMMARY,
            status="completed",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        print(f"[OK] Registered DevWorkLog id={entry.id}: {TITLE}")
