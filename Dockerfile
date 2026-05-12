# CUSTOM — Do not auto-generate. Fullstack: React + FastAPI
# Stage 1: Build admin frontend
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY SodamApp/frontend/package*.json ./
RUN npm ci
COPY SodamApp/frontend/ ./
ENV VITE_API_URL=""
RUN npm run build && \
    find dist -name '*.js' -exec sed -i 's|http://localhost:8000||g' {} +

# Stage 2: Build staff app
FROM node:20-slim AS staff-build
WORKDIR /build
COPY SodamApp/staff-app/package*.json ./
RUN npm ci
COPY SodamApp/staff-app/ ./
ENV VITE_API_URL=""
RUN npm run build && \
    find dist -name '*.js' -exec sed -i 's|http://localhost:8000||g' {} +

# Stage 3: Production image
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libfribidi0 \
    fonts-nanum fonts-noto-cjk \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Timezone: 호스트 cron 이 KST 기준으로 실행되므로 컨테이너도 KST 통일.
# 그렇지 않으면 date.today() / "어제" 계산이 UTC 기준이 되어 1일 차이 발생.
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

COPY SodamApp/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium 다운로드 + 시스템 의존성 자동 설치
# (쿠팡이츠 사장님 포털 자동 로그인 — Akamai sensor 통과용)
# 이미지 크기 ~300MB 증가. 컨테이너 cold start 시 1회만 다운로드.
RUN python -m playwright install --with-deps chromium

COPY SodamApp/backend/ ./
COPY start.py ./start.py

COPY --from=frontend-build /build/dist /app/static
COPY --from=staff-build /build/dist /app/staff-static

EXPOSE ${PORT:-3788}

CMD ["sh", "-c", "uvicorn start:app --host 0.0.0.0 --port ${PORT:-3788}"]
