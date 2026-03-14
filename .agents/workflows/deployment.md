---
description: SodamFN 배포 프로세스 - Orbitron 배포 서버 사용
---

# SodamFN 배포 아키텍처

## ⚠️ 핵심 규칙

- **배포는 사용자의 리눅스 컴퓨터에 설치된 Orbitron 배포 전용 서버에서 진행**
- Windows 로컬 환경에서는 개발 및 코드 수정만 수행
- 배포 트리거는 사용자가 직접 Orbitron에서 실행

## 🚨 파일 스토리지 — 반드시 숙지

> **DB(PostgreSQL)와 파일(uploads/)은 완전히 분리되어 있다.**
> DB는 로컬/프로덕션이 동일한 Orbitron PostgreSQL을 공유하지만,
> 파일은 각 환경의 **로컬 디스크**에 별도로 저장된다.

| 항목 | 로컬 (Windows) | 프로덕션 (Orbitron Docker) |
|------|---------------|--------------------------|
| **DB** | Orbitron PostgreSQL (공유) | Orbitron PostgreSQL (공유) |
| **파일** | `backend\uploads\` (Windows 디스크) | `/app/uploads/` (Docker persistent disk) |

### ❌ 절대 하면 안 되는 것

1. **로컬에서 파일을 업로드하고 프로덕션에서 보이길 기대하는 것** — 파일은 공유되지 않음
2. **persistent disk 설정 없이 Docker 재빌드** — `uploads/` 폴더가 초기화됨
3. **파일 경로를 DB에 저장할 때 절대 경로 사용** — 환경마다 경로가 다르므로 항상 상대 경로 사용

### ✅ 파일 업로드 관련 작업 시 체크리스트

- [ ] `Orbitron.yaml`의 `disk` 설정이 유지되고 있는지 확인
- [ ] 파일 서빙 엔드포인트가 한글 파일명을 처리하는지 확인 (`FileResponse` 사용)
- [ ] 프론트엔드에서 파일 URL 구성 시 `encodeURIComponent()` 사용 여부 확인

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

## Persistent Disk 설정 (Orbitron.yaml)

```yaml
disk:
  name: sodam-uploads
  mountPath: /app/uploads
  sizeGB: 1
```

> 이 설정이 없으면 Docker 재빌드 시 업로드된 모든 파일이 유실됨!

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
