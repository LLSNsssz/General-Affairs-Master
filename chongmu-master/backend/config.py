"""앱 전역 설정 — 환경변수 우선, 없으면 기본값(로컬 개발용)"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# 데이터 저장 위치 (NAS 볼륨 마운트 대상)
# - DATA_DIR: DB 파일이 들어갈 디렉터리
# - UPLOAD_DIR: 업로드 파일이 들어갈 디렉터리
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR)))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "chongmu.db")))

# DATABASE_URL을 직접 지정하면 그걸 우선 (PostgreSQL 전환 대비)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")
