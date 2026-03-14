---
description: 셈하나(SEMHANA) 프로젝트 아키텍처 및 핵심 참고사항
---

# 셈하나 프로젝트 구조

## 디렉토리 구조

```
c:\WORK\SodamFN\
├── SodamApp/
│   ├── backend/          # FastAPI 백엔드 (Python, PostgreSQL - Orbitron)
│   ├── frontend/         # 관리자 앱 (React + Vite, port 5173)
│   └── staff-app/        # 직원 PWA 앱 (React + Vite, port 5174)
├── Orbitron.yaml          # Orbitron 배포 설정 (3 서비스 통합)
└── .agents/workflows/     # AI 작업 워크플로우
```

## 핵심 기억사항

### 배포

- **반드시 /deployment 워크플로우 참조** — 배포는 Orbitron (Linux) 서버에서 진행
- Orbitron이 백엔드 + 관리자앱 + 직원앱 3개 서비스 통합 배포
- Windows에서는 커밋/푸시만 수행
- 배포 URL: Admin=`sodamfn.twinverse.org`, Staff=`sodam-staff.pages.dev`
- DB: PostgreSQL (Orbitron 서버 192.168.219.101:5432/sodamfn, 로컬/프로덕션 동일)

### 🚨 파일 스토리지 (매우 중요)

- **DB와 파일은 완전히 분리됨**: DB(PostgreSQL)는 로컬/프로덕션 공유, 파일(`uploads/`)은 각 환경 별도 디스크
- **로컬에서 업로드한 파일은 프로덕션에 없음** — 반드시 프로덕션에서 직접 업로드해야 함
- **Docker 재빌드 시 persistent disk 설정(`Orbitron.yaml`의 `disk`) 없으면 파일 유실**
- 파일 서빙: `/api/hr/staff/doc-file/{id}/{filename}` 엔드포인트 사용 (한글 파일명 지원)
- 상세 사항은 `/deployment` 워크플로우 참조

### 작업 시작 시

- **반드시 /start 워크플로우 실행** — HEAD 콘텐츠 + 최근 작업일지 자동 확인
- 작업 완료 후 작업일지에 기록 (DevWorkLog API 또는 DB 직접 삽입)

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
