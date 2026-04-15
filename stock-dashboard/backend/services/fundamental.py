"""재무제표 분석 서비스"""

from datetime import datetime, timedelta
import yfinance as yf
from pykrx import stock as krx_stock


def get_fundamentals(symbol: str, market: str) -> dict:
    """재무 지표 조회"""
    if market == "KR":
        return _get_kr_fundamentals(symbol)
    return _get_us_fundamentals(symbol)


def _get_kr_fundamentals(symbol: str) -> dict:
    """한국 주식 재무 지표 (pykrx)"""
    today = datetime.now().strftime("%Y%m%d")
    try:
        df = krx_stock.get_market_fundamental(today, today, symbol)
        if df.empty:
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y%m%d")
            df = krx_stock.get_market_fundamental(yesterday, yesterday, symbol)
        if df.empty:
            return _empty_fundamentals()

        row = df.iloc[-1]
        eps = float(row.get("EPS", 0))
        bps = float(row.get("BPS", 0))
        roe = round(eps / bps * 100, 2) if bps != 0 else 0

        return {
            "per": round(float(row.get("PER", 0)), 2),
            "pbr": round(float(row.get("PBR", 0)), 2),
            "eps": round(eps, 0),
            "bps": round(bps, 0),
            "div_yield": round(float(row.get("DIV", 0)), 2),
            "dps": round(float(row.get("DPS", 0)), 0),
            "roe": roe,
            "market": "KR",
        }
    except Exception:
        return _empty_fundamentals()


def _get_us_fundamentals(symbol: str) -> dict:
    """미국 주식 재무 지표 (yfinance)"""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        return {
            "per": round(float(info.get("trailingPE", 0) or 0), 2),
            "pbr": round(float(info.get("priceToBook", 0) or 0), 2),
            "eps": round(float(info.get("trailingEps", 0) or 0), 2),
            "bps": round(float(info.get("bookValue", 0) or 0), 2),
            "div_yield": round(float(info.get("dividendYield", 0) or 0) * 100, 2),
            "roe": round(float(info.get("returnOnEquity", 0) or 0) * 100, 2),
            "market_cap": info.get("marketCap", 0),
            "sector": info.get("sector", ""),
            "market": "US",
        }
    except Exception:
        return _empty_fundamentals()


def _empty_fundamentals() -> dict:
    return {
        "per": 0, "pbr": 0, "eps": 0, "bps": 0,
        "div_yield": 0, "roe": 0, "market": "",
    }
