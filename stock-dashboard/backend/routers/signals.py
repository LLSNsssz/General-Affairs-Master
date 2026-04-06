"""신호등 API 라우터"""

from fastapi import APIRouter
from services.signal_engine import compute_signal
from services.news_scraper import get_news_sentiment
from services.investor_flow import get_investor_flow_score
from config import DEFAULT_KR_STOCKS, DEFAULT_US_STOCKS

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.get("/summary")
async def signals_summary(market: str = "all"):
    """전체 종목 신호등 요약"""
    results = []

    if market in ("all", "kr"):
        for code, name in DEFAULT_KR_STOCKS.items():
            try:
                news = get_news_sentiment(code, "KR", limit=5)
                inv = get_investor_flow_score(code)
                sig = compute_signal(code, "KR", news, inv)
                results.append({
                    "symbol": code,
                    "name": name,
                    "market": "KR",
                    **_signal_summary(sig),
                })
            except Exception:
                results.append({
                    "symbol": code, "name": name, "market": "KR",
                    "level": "YELLOW", "score": 50, "is_capitulation": False,
                })

    if market in ("all", "us"):
        for symbol, name in DEFAULT_US_STOCKS.items():
            try:
                news = get_news_sentiment(symbol, "US", limit=5)
                sig = compute_signal(symbol, "US", news, 0.0)
                results.append({
                    "symbol": symbol,
                    "name": name,
                    "market": "US",
                    **_signal_summary(sig),
                })
            except Exception:
                results.append({
                    "symbol": symbol, "name": name, "market": "US",
                    "level": "YELLOW", "score": 50, "is_capitulation": False,
                })

    return {"signals": results}


@router.get("/{market}/{symbol}")
async def single_signal(market: str, symbol: str):
    """단일 종목 신호등"""
    market = market.upper()
    news = get_news_sentiment(symbol, market, limit=5)
    inv = get_investor_flow_score(symbol) if market == "KR" else 0.0
    sig = compute_signal(symbol, market, news, inv)
    return sig


def _signal_summary(sig: dict) -> dict:
    return {
        "level": sig["signal_level"],
        "score": sig["signal_score"],
        "is_capitulation": sig["is_capitulation"],
    }
