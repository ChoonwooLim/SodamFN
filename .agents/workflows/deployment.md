---
description: SodamFN 배포 프로세스 - Orbitron 배포 서버 사용
---

# SodamFN 배포 아키텍처

## ⚠️ 핵심 규칙

- **배포는 사용자의 리눅스 컴퓨터에 설치된 Orbitron 배포 전용 서버에서 진행**
- Windows 로컬 환경에서는 개발 및 코드 수정만 수행
- 배포 트리거는 사용자가 직접 Orbitron에서 실행

## 🚨 파일 스토리지 아키텍처

### Cloudflare R2 (2026-03-14 도입)

모든 파일 업로드는 `services/storage_service.py`를 통해 **Cloudflare R2**에 저장됨.
R2 환경변수 미설정 시 자동으로 **로컬 디스크 fallback** 동작.

```
파일 업로드 흐름:
Router → get_storage() → R2 (primary) or Local Disk (fallback) → Public URL 반환
```

| 모드 | 조건 | 저장 위치 | URL 형식 |
|------|------|----------|---------|
| **R2** | 환경변수 설정됨 | Cloudflare R2 버킷 | `https://pub-xxx.r2.dev/key` |
| **Fallback** | 환경변수 없음 | 로컬 `uploads/` | `/uploads/key` |

### R2 환경변수 (`.env` 및 Orbitron secrets)

```env
R2_ACCOUNT_ID=<Cloudflare Account ID>
R2_ACCESS_KEY_ID=<R2 API Token Access Key>
R2_SECRET_ACCESS_KEY=<R2 API Token Secret Key>
R2_BUCKET_NAME=sodam-uploads
R2_PUBLIC_URL=<R2 Public URL>
```

### 파일 업로드 사용처 (3곳, 모두 `get_storage()` 사용)

| 라우터 | 용도 | Storage Key 패턴 |
|--------|------|-----------------|
| `hr.py` | 직원 서류 (보건증 등) | `staff_docs/{id}/{filename}` |
| `upload.py` | 비즈니스 로고 | `logos/{filename}` |
| `products.py` | 상품 이미지 | `product_images/{filename}` |

### ❌ 절대 하면 안 되는 것

1. **`storage_service.py`를 우회하여 직접 `shutil.copyfileobj` 사용 금지** — 반드시 `get_storage()` 사용
2. **R2 fallback 모드(로컬 디스크)에서 파일을 업로드하고 프로덕션에서 보이길 기대하지 말 것**
3. **파일 URL을 하드코딩하지 말 것** — `storage_service`가 반환하는 URL을 그대로 DB에 저장

### ✅ 파일 관련 작업 시 체크리스트

- [ ] 새 파일 업로드 기능 추가 시 반드시 `from services.storage_service import get_storage` 사용
- [ ] DB에 저장하는 파일 경로는 `storage.upload_file()`이 반환하는 URL 그대로 저장
- [ ] 프론트엔드에서 `file_path`가 `http`로 시작하면 직접 사용, 아니면 base URL 붙이기

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

## Persistent Disk 설정 (Orbitron.yaml, fallback용)

```yaml
disk:
  name: sodam-uploads
  mountPath: /app/uploads
  sizeGB: 1
```

> R2 미설정 시 로컬 디스크 fallback이 사용되므로, 이 설정은 유지 필요.

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
- `R2_*`: Cloudflare R2 설정 (위 참조)

## 주의사항

- `deploy.py` (backend)는 로컬에서 Cloudflare 직접 배포하는 레거시 코드. 실제 배포는 Orbitron 사용
- 코드 수정 후 커밋/푸시만 하면 사용자가 Orbitron에서 재배포 진행
