"""FastAPI application entrypoint for Stock Dashboard."""

from contextlib import asynccontextmanager
import logging
import os
import sys
from time import perf_counter
from uuid import uuid4

# Ensure local imports work in both `python backend/app.py` and `uvicorn backend.app:app`.
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import APP_VERSION, CORS_ORIGINS, DATABASE_MODE, ENV, HOST, PORT, SUPABASE_KEY, SUPABASE_URL
from database import check_db_health, init_db
from logging_utils import SimpleRateLimiter, log_event, setup_logging
from routers import analysis, investors, news, portfolio, signals, stocks, watchlist

setup_logging()
logger = logging.getLogger("stock_dashboard")
rate_limiter = SimpleRateLimiter()
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
FRONTEND_ENABLED = os.path.isdir(FRONTEND_DIR)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    log_event(
        logger,
        logging.INFO,
        "startup",
        environment=ENV,
        database_mode=DATABASE_MODE,
        frontend_enabled=FRONTEND_ENABLED,
        host=HOST,
        port=PORT,
    )
    yield

app = FastAPI(
    title="Stock Dashboard",
    description="한국/미국 주식 분석 대시보드",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(analysis.router)
app.include_router(signals.router)
app.include_router(portfolio.router)
app.include_router(watchlist.router)
app.include_router(news.router)
app.include_router(investors.router)

if FRONTEND_ENABLED:
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    async def index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/login")
    async def login_page():
        return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))


@app.middleware("http")
async def api_observability_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid4().hex
    client_ip = request.client.host if request.client else "unknown"
    start_time = perf_counter()
    is_api_request = request.url.path.startswith("/api/")

    if is_api_request and not rate_limiter.allow(client_ip):
        retry_after = rate_limiter.retry_after(client_ip)
        log_event(
            logger,
            logging.WARNING,
            "rate_limited",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            retry_after=retry_after,
        )
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests", "request_id": request_id},
            headers={"Retry-After": str(retry_after), "X-Request-ID": request_id},
        )

    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = round((perf_counter() - start_time) * 1000, 2)
        log_event(
            logger,
            logging.ERROR,
            "request_failed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            duration_ms=duration_ms,
            error=repr(exc),
        )
        raise

    response.headers["X-Request-ID"] = request_id

    if is_api_request:
        duration_ms = round((perf_counter() - start_time) * 1000, 2)
        log_event(
            logger,
            logging.INFO,
            "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )

    return response


@app.get("/api/config/public")
async def public_config():
    return {
        "supabase_url": SUPABASE_URL or None,
        "supabase_key": SUPABASE_KEY or None,
    }


@app.get("/api/health")
async def health():
    database = check_db_health()
    status = "ok" if database["ok"] else "degraded"
    return {
        "status": status,
        "version": APP_VERSION,
        "environment": ENV,
        "database": database,
        "frontend_enabled": FRONTEND_ENABLED,
    }


@app.get("/api/health/ready")
async def ready():
    database = check_db_health()
    payload = {
        "status": "ready" if database["ok"] else "not_ready",
        "version": APP_VERSION,
        "database": database,
    }
    return JSONResponse(status_code=200 if database["ok"] else 503, content=payload)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
