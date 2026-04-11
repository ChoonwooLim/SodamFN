---
title: AI Gateway Phase 1 — 이전 후 검증 절차
date: 2026-04-11
---

# 이전 후 검증 절차

`02-migrate-hf-cache.bat` + `03-set-env-vars.bat` 실행 후, **재부팅**하고 아래 순서로 검증합니다.

## 1단계: 환경변수 확인 (새 터미널)

```cmd
echo %HF_HOME%
echo %HF_HUB_CACHE%
echo %TRANSFORMERS_CACHE%
echo %OLLAMA_MODELS%
```

**기대 출력:**
```
D:\SodamAI\models\huggingface
D:\SodamAI\models\huggingface\hub
D:\SodamAI\models\huggingface\hub
D:\SodamAI\models\ollama
```

## 2단계: 파일 이전 검증

```powershell
powershell -Command "Get-ChildItem D:\SodamAI\models\huggingface\hub | Measure-Object -Property Length -Sum"
```

→ 49 GB 내외 숫자가 나오면 성공.

## 3단계: Python HF 라이브러리 경로 인식 확인

SodamAI 서비스 venv 중 하나에서:
```cmd
cd D:\SodamAI\image-service
.\venv\Scripts\activate
python -c "from huggingface_hub import constants; print('HF_HUB_CACHE =', constants.HF_HUB_CACHE)"
```

**기대 출력:**
```
HF_HUB_CACHE = D:\SodamAI\models\huggingface\hub
```

## 4단계: 실서비스 동작 확인

- [ ] Wan2GP 실행 → 모델 재다운로드 안 하고 즉시 로드
- [ ] ComfyUI 실행 → diffusion_models 정상 인식
- [ ] SodamAI image-service 실행 → Flux 모델 정상 로드

## 5단계: 원본 삭제 (검증 통과 후에만!)

```cmd
rmdir /S /Q "C:\Users\choon\.cache\huggingface"
```

## 문제 발생 시

- **환경변수 미적용**: 재부팅 필수. `setx`는 이미 실행 중인 explorer/터미널에 반영 안 됨.
- **파일 경로 오류**: `rollback-env-vars.bat` 실행 → 원래 경로로 복구.
- **robocopy 실패**: `migrate-hf-cache.log` 확인. 바이러스 검사 프로그램이 간섭할 수 있음.

## Ollama 설치 (검증 통과 후)

```cmd
# Ollama 공식 설치 후 새 터미널에서:
ollama pull gemma4:e4b
ollama list
```

→ `D:\SodamAI\models\ollama\manifests\` 에 gemma4 매니페스트가 생성되면 성공.
