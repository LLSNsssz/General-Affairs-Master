"""총무 마스터 - FastAPI 메인 앱"""

import sys
from pathlib import Path

# ensure backend/ is on sys.path for uvicorn reload
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import init_db
from routers import certificates, vehicles, tax_clearances, seals, contracts, upload

app = FastAPI(title="총무 마스터", version="1.0.0")

frontend_dir = Path(__file__).resolve().parent.parent / "frontend"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 (먼저 등록)
app.include_router(certificates.router)
app.include_router(vehicles.router)
app.include_router(tax_clearances.router)
app.include_router(seals.router)
app.include_router(contracts.router)
app.include_router(upload.router)

# 정적 파일 (css, js 등)
app.mount("/css", StaticFiles(directory=str(frontend_dir / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(frontend_dir / "js")), name="js")


@app.get("/")
def serve_index():
    return FileResponse(str(frontend_dir / "index.html"))


@app.on_event("startup")
def on_startup():
    init_db()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8201, reload=True)
