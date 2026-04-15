"""Stock Dashboard v2 - FastAPI 엔트리포인트"""

import sys
import os

# backend/ 디렉토리를 Python path에 추가
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import HOST, PORT, CORS_ORIGINS, SUPABASE_URL, SUPABASE_KEY
from database import init_db
from routers import stocks, analysis, signals, portfolio, news, investors

app = FastAPI(
    title="Stock Dashboard",
    description="종합 주식 분석 플랫폼 - 한국/미국",
    version="2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(stocks.router)
app.include_router(analysis.router)
app.include_router(signals.router)
app.include_router(portfolio.router)
app.include_router(news.router)
app.include_router(investors.router)

# 프론트엔드 정적 파일 (로컬 개발용)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    async def index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/login")
    async def login_page():
        return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))


# 프론트엔드에 Supabase 공개 설정 전달 (anon key만)
@app.get("/api/config/public")
async def public_config():
    return {
        "supabase_url": SUPABASE_URL if SUPABASE_URL else None,
        "supabase_key": SUPABASE_KEY if SUPABASE_KEY else None,
    }


@app.on_event("startup")
async def startup():
    init_db()
    print(f"[Stock Dashboard] Server starting on {HOST}:{PORT}")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
