"""주식 시세 API 라우터"""

from datetime import datetime
from fastapi import APIRouter
from services.stock_data import get_kr_stock_data, get_us_stock_data, get_chart_data, search_stocks

router = APIRouter(prefix="/api", tags=["stocks"])


@router.get("/stocks")
async def list_stocks(market: str = "all"):
    data = []
    if market in ("all", "kr"):
        data.extend(get_kr_stock_data())
    if market in ("all", "us"):
        data.extend(get_us_stock_data())
    return {"stocks": data, "updated_at": datetime.now().isoformat()}


@router.get("/chart/{market}/{symbol}")
async def chart(market: str, symbol: str, days: int = 30):
    data = get_chart_data(symbol, market.upper(), days)
    return {"chart": data}


@router.get("/search")
async def search(q: str):
    results = search_stocks(q)
    return {"results": results}
