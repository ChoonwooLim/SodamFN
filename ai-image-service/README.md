# SodamFN AI Image Service

Flux.1-schnell 기반 오픈소스 이미지 생성 서버 + Real-ESRGAN 업스케일러.

## 초기 설정

```powershell
py -3.12 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
```

설치 직후 `basicsr` 호환성 패치가 필요할 수 있습니다:
```
.venv\Lib\site-packages\basicsr\data\degradations.py
  (라인 8) from torchvision.transforms.functional_tensor import rgb_to_grayscale
  →        from torchvision.transforms.functional import rgb_to_grayscale
```

## 실행

```
run.bat
```
또는
```powershell
.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8100
```

포트 `8100`에서 listen합니다. 백엔드 `.env`의 `AI_GPU_SERVER_URL`과 일치시켜주세요.

## 엔드포인트

| 경로 | 설명 |
|------|------|
| `GET /health` | GPU/RAM 상태 |
| `POST /generate` | Text-to-Image (Flux.1-schnell) |
| `POST /img2img` | Image-to-Image |
| `POST /upscale` | Real-ESRGAN 업스케일 |
| `POST /remove-bg` | 배경 제거 (rembg, 선택 설치) |
| `POST /inpaint` | LaMa 인페인팅 (선택 설치) |

`rembg`와 `simple-lama-inpainting`은 필요 시 별도 설치:
```
.venv\Scripts\pip install rembg[gpu] simple-lama-inpainting
```
