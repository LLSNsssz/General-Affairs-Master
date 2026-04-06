"""뉴스 API 라우터"""

from fastapi import APIRouter
from services.news_scraper import get_news

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/{market}/{symbol}")
async def news(market: str, symbol: str, limit: int = 10):
    data = get_news(symbol, market.upper(), limit)
    return {"news": data}
