---
title: AI Gateway Phase 1 — 인프라 이전/통합 제안서
date: 2026-04-11
status: ready-for-execution
---

# AI Gateway Phase 1 — 인프라 이전/통합 제안서

> 목적: 흩어진 AI 자산을 **`D:\SodamAI\models\`** 단일 루트로 통합하여 Gemma 4 도입 및 모델 관리 일원화.

## 1. 현황 스냅샷 (2026-04-11 스캔 결과)

### 1.1 주요 AI 자산 위치

| 위치 | 용량 | 내용 | 이전 대상? |
|------|------|------|-----------|
| `C:\Users\choon\.cache\huggingface\` | **49.92 GB** | Flux, Wan2.2 시리즈, SVD 등 HF 모델 캐시 | ✅ **필수 이전** |
| `D:\ComfyUI\models\diffusion_models\` | 41.18 GB | HiDream (31.86 GB) 외 | 🟡 선택 이전 |
| `D:\ComfyUI\models\checkpoints\` | 8.90 GB | SD 계열 체크포인트 | 🟡 선택 이전 |
| `D:\ComfyUI_portable\` | 18.2 GB | 중복 포터블 설치 | 🗑️ 삭제 검토 |
| `D:\Wan2GP\models\*` | 0 GB | 전부 빈 폴더 (HF 캐시 사용) | ⏭️ 이전 불필요 |
| `D:\SodamAI\{image,video,tts,music}-service\venv` | 21.0 GB | venv + 코드 (모델 없음) | ⏭️ 이전 불필요 |

### 1.2 디스크 여유

- **D: 드라이브**: 6,078 GB 여유 (용량 걱정 없음)
- **C: 드라이브**: HF 캐시 이전 후 약 50 GB 확보 예상

## 2. 통합 폴더 구조 (생성 완료)

```
D:\SodamAI\models\
├── huggingface\
│   └── hub\              # ← C:\Users\choon\.cache\huggingface\hub 이전 대상
├── ollama\
│   ├── blobs\            # ← 신규 Ollama 저장소 (Gemma 4 등)
│   └── manifests\
└── comfyui\              # ← (선택) HiDream 등 대용량 체크포인트 이전 대상
```

✅ 2026-04-11 현재 모든 폴더 생성 완료.

## 3. 이전 매핑표

| # | 출처 | 대상 | 방법 | 용량 | 우선순위 |
|---|------|------|------|------|---------|
| 1 | `C:\Users\choon\.cache\huggingface\hub\*` | `D:\SodamAI\models\huggingface\hub\` | `robocopy /MOVE` | 49.92 GB | **P0 필수** |
| 2 | (신규) Ollama 설치 | `D:\SodamAI\models\ollama\` | `OLLAMA_MODELS` 환경변수 | 신규 | **P0 필수** |
| 3 | `D:\ComfyUI\models\diffusion_models\HiDream\*` | `D:\SodamAI\models\comfyui\diffusion_models\HiDream\` | `robocopy /MOVE` + 심볼릭 링크 | 31.86 GB | 🟡 선택 |
| 4 | `D:\ComfyUI_portable\` | — | 삭제 (중복 확인 후) | 18.2 GB | 🟡 선택 |

## 4. 환경변수 재지정 계획

HF 캐시 이전 후, 모든 HF 기반 서비스가 새 경로를 인식하도록 **시스템 환경변수 3개** 등록:

| 변수명 | 값 | 영향 |
|--------|-----|------|
| `HF_HOME` | `D:\SodamAI\models\huggingface` | HuggingFace 전체 루트 |
| `HF_HUB_CACHE` | `D:\SodamAI\models\huggingface\hub` | 모델 다운로드 캐시 |
| `TRANSFORMERS_CACHE` | `D:\SodamAI\models\huggingface\hub` | transformers 라이브러리 호환성 |
| `OLLAMA_MODELS` | `D:\SodamAI\models\ollama` | Ollama 모델 저장소 |

> ⚠️ `setx`는 **새로 여는 터미널/프로세스**부터 적용됨. 기존 SodamAI 서비스(`image-service`, `video-service` 등)는 재시작 필요.

## 5. 영향 범위 & 호환성 체크

### 5.1 현재 HF 캐시를 사용하는 것으로 확인된 서비스

- `D:\Wan2GP\` (Wan2.2, Flux 등을 HF 허브에서 자동 다운로드)
- `D:\SodamAI\image-service\` (venv 내 diffusers/transformers)
- `D:\SodamAI\video-service\`
- `D:\SodamAI\tts-service\`

### 5.2 이전 후 검증 체크리스트

- [ ] 환경변수 3개 `echo %HF_HOME%` 등으로 확인
- [ ] 새 터미널에서 `python -c "from huggingface_hub import constants; print(constants.HF_HUB_CACHE)"` → D: 경로 출력 확인
- [ ] Wan2GP 한 번 실행 → 기존 모델 재다운로드 안 함 확인
- [ ] `C:\Users\choon\.cache\huggingface\` 폴더 비었는지 확인 (robocopy /MOVE 후)

## 6. 실행 순서 (권장)

```
1) 현재 실행 중인 모든 AI 서비스 종료 (Wan2GP, ComfyUI, SodamAI 서비스 등)
       ↓
2) 스크립트 02-migrate-hf-cache.bat 실행 (robocopy /MOVE)
       ↓ [약 10~30분, SSD 기준]
3) 스크립트 03-set-env-vars.bat 실행 (setx 시스템 환경변수 등록)
       ↓
4) PC 재부팅 또는 새 터미널에서 검증 체크리스트 수행
       ↓
5) Ollama 설치 → OLLAMA_MODELS 인식 확인 → gemma4:e4b pull
       ↓
6) 두 번째 RTX 3090 물리 설치 → CUDA_VISIBLE_DEVICES=1 격리
       ↓
7) Cloudflare Tunnel 경로 추가 (twinverseDesk 기존 프로젝트)
       ↓
8) Phase 1 백엔드 구현 (writing-plans 스킬로 플랜 작성 후 착수)
```

## 7. 롤백 계획

- `robocopy /MOVE` 대신 **1단계에서는 `/COPY` 사용 권장** → 검증 완료 후 원본 삭제
- 환경변수는 이전 값을 `rollback-env-vars.bat`에 저장
- ComfyUI 이전은 심볼릭 링크 방식 → 문제 시 링크 제거로 즉시 복구

## 8. 다음 문서

- `02-migrate-hf-cache.bat` — HF 캐시 이전 스크립트
- `03-set-env-vars.bat` — 환경변수 등록 스크립트
- `04-verification.md` — 이전 후 검증 절차
