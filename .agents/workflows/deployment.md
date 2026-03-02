---
description: SodamFN 배포 프로세스 - Orbitron 배포 서버 사용
---

# SodamFN 배포 아키텍처

## ⚠️ 핵심 규칙

- **배포는 사용자의 리눅스 컴퓨터에 설치된 Orbitron 배포 전용 서버에서 진행**
- Windows 로컬 환경에서는 개발 및 코드 수정만 수행
- 배포 트리거는 사용자가 직접 Orbitron에서 실행

## 서비스 구성 (3개)

| 서비스 | 타입 | 소스 디렉토리 | 배포 URL |
|--------|------|--------------|----------|
| **Backend** (FastAPI) | web | `SodamApp/backend` | `https://sodamfn.twinverse.org` (API) |
| **Admin Frontend** (React+Vite) | static | `SodamApp/frontend` | `https://sodamfn.twinverse.org` |
| **Staff App** (React PWA) | static | `SodamApp/staff-app` | `https://sodam-staff.pages.dev` |

## 배포 흐름

1. 개발자가 코드 수정 → `git commit` → `git push` (Windows에서)
2. Orbitron 서버(Linux)에서 git pull + 빌드 + Cloudflare Pages 배포
3. 배포 설정: `Orbitron.yaml` (루트 디렉토리)

## 로컬 개발 포트

| 서비스 | 포트 |
|--------|------|
| Backend (uvicorn) | `localhost:8000` |
| Admin Frontend (Vite) | `localhost:5173` |
| Staff App (Vite) | `localhost:5174` |

## Cloudflare Pages 프로젝트명

- Staff App: `sodam-staff` → `sodam-staff.pages.dev`
- Admin App: `sodamfn` → `sodamfn.twinverse.org` (커스텀 도메인)

## 환경 변수

- `VITE_API_URL`: Backend API URL (배포 시 자동 설정)
- `VITE_STAFF_APP_URL`: Staff App URL (배포 시 자동 설정)

## 주의사항

- `deploy.py` (backend)는 로컬에서 Cloudflare 직접 배포하는 레거시 코드. 실제 배포는 Orbitron 사용
- 코드 수정 후 커밋/푸시만 하면 사용자가 Orbitron에서 재배포 진행
