"""종목 분석 API 라우터"""

from fastapi import APIRouter, Request
from services.stock_data import get_ohlcv_dataframe
from services.technical import calculate_all
from services.fundamental import get_fundamentals
from services.signal_engine import compute_signal
from services.news_scraper import get_news_sentiment
from services.investor_flow import get_investor_flow_score
from services.ai_analyzer import generate_analysis
from auth import get_current_user

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/{market}/{symbol}")
async def full_analysis(market: str, symbol: str, request: Request):
    """종합 분석: 기술적 지표 + 재무 + 신호등 + AI 리포트"""
    market = market.upper()

    # 기술적 지표
    df = get_ohlcv_dataframe(symbol, market, days=120)
    indicators = calculate_all(df)

    # 재무 지표
    fundamentals = get_fundamentals(symbol, market)

    # 뉴스 감성
    news_score = get_news_sentiment(symbol, market)

    # 외인/기관 흐름 (한국만)
    investor_score = 0.0
    if market == "KR":
        investor_score = get_investor_flow_score(symbol)

    # 신호등
    signal = compute_signal(symbol, market, news_score, investor_score)

    # 포트폴리오 정보 (로그인 시)
    holding_info = None
    user_id = await get_current_user(request)
    if user_id:
        from services.portfolio_service import get_holdings
        holdings = get_holdings(user_id)
        for h in holdings:
            if h["symbol"] == symbol and h["market"] == market:
                holding_info = {"avg_price": h["avg_price"], "quantity": h["quantity"]}
                break

    # AI 리포트
    ai_report = await generate_analysis(symbol, market, indicators, fundamentals, signal, holding_info)

    return {
        "symbol": symbol,
        "market": market,
        "indicators": indicators,
        "fundamentals": fundamentals,
        "signal": {
            "level": signal["signal_level"],
            "score": signal["signal_score"],
            "is_capitulation": signal["is_capitulation"],
            "breakdown": signal["breakdown"],
        },
        "ai_report": ai_report,
        "news_sentiment": news_score,
        "investor_score": investor_score,
    }


@router.get("/{market}/{symbol}/technical")
async def technical_only(market: str, symbol: str):
    df = get_ohlcv_dataframe(symbol, market.upper(), days=120)
    return calculate_all(df)


@router.get("/{market}/{symbol}/fundamental")
async def fundamental_only(market: str, symbol: str):
    return get_fundamentals(symbol, market.upper())
