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

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY SodamApp/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY SodamApp/backend/ ./
COPY start.py ./start.py

COPY --from=frontend-build /build/dist /app/static
COPY --from=staff-build /build/dist /app/staff-static

EXPOSE ${PORT:-3788}

CMD ["sh", "-c", "uvicorn start:app --host 0.0.0.0 --port ${PORT:-3788}"]
