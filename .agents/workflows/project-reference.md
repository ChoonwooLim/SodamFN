---
description: SodamFN 프로젝트 아키텍처 및 핵심 참고사항
---

# SodamFN 프로젝트 구조

## 디렉토리 구조

```
c:\WORK\SodamFN\
├── SodamApp/
│   ├── backend/          # FastAPI 백엔드 (Python, SQLite로컬/PostgreSQL배포)
│   ├── frontend/         # 관리자 앱 (React + Vite, port 5173)
│   └── staff-app/        # 직원 PWA 앱 (React + Vite, port 5174)
├── Orbitron.yaml          # Orbitron 배포 설정 (3 서비스)
├── render.yaml            # Render 배포 설정 (레거시)
└── docs/
```

## 핵심 기억사항

### 배포

- **반드시 /deployment 워크플로우 참조** — 배포는 Orbitron (Linux) 서버에서 진행
- Windows에서는 커밋/푸시만 수행
- 배포 URL: Admin=`sodamfn.twinverse.org`, Staff=`sodam-staff.pages.dev`

### 로그인/라우팅

- Admin 앱 로그인 후: `admin` → `/dashboard`, 비관리자 → `/staff-dashboard`
- Staff 앱: 온보딩 → 로그인 → 홈 (토큰 기반 ProtectedRoute)
- Staff 앱 온보딩 완료 시 이전 세션 토큰 자동 제거

### Staff App 버전 히스토리

- v1: 아주 초기 (전자계약만 있는 단순 버전)
- v2: 중간 수정 (기본 기능 + 홈 화면)
- v3: 최신 현재 버전 (오픈체크리스트, 재고체크 등 추가)

### API 설정

- 로컬: `http://localhost:8000` (backend .venv에서 uvicorn 실행)
- 배포: `https://sodamfn.twinverse.org` (Orbitron 관리)
