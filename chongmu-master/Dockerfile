FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Seoul

WORKDIR /app

# 시스템 패키지 (tzdata만 — SQLite는 파이썬 내장)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata curl \
    && rm -rf /var/lib/apt/lists/*

# 파이썬 의존성
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 앱 코드
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/

# NAS에서 볼륨 마운트할 경로
ENV DATA_DIR=/data \
    UPLOAD_DIR=/data/uploads
VOLUME ["/data"]

EXPOSE 8201

WORKDIR /app/backend

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fs http://localhost:8201/ || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8201"]
