"""Fundamental metrics service."""

import yfinance as yf

from pykrx_compat import call_quietly, krx_stock
from services.stock_data import find_latest_kr_trading_day


def get_fundamentals(symbol: str, market: str) -> dict:
    """Fetch fundamentals for KR or US stocks."""
    if market == "KR":
        return _get_kr_fundamentals(symbol)
    return _get_us_fundamentals(symbol)


def _get_kr_fundamentals(symbol: str) -> dict:
    """Fetch KR fundamentals using the latest trading day available."""
    latest_day = find_latest_kr_trading_day(symbol)
    if latest_day is None:
        return _empty_fundamentals()

    date_str = latest_day.strftime("%Y%m%d")
    try:
        df = call_quietly(krx_stock.get_market_fundamental, date_str, date_str, symbol)
        if df.empty:
            return _empty_fundamentals()

        row = df.iloc[-1]
        eps = float(row.get("EPS", 0))
        bps = float(row.get("BPS", 0))
        roe = round(eps / bps * 100, 2) if bps else 0

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
    """Fetch US fundamentals from yfinance."""
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
            "dps": round(float(info.get("dividendRate", 0) or 0), 2),
            "market_cap": info.get("marketCap", 0),
            "sector": info.get("sector", ""),
            "market": "US",
        }
    except Exception:
        return _empty_fundamentals()


def _empty_fundamentals() -> dict:
    return {
        "per": 0,
        "pbr": 0,
        "eps": 0,
        "bps": 0,
        "div_yield": 0,
        "dps": 0,
        "roe": 0,
        "market_cap": 0,
        "sector": "",
        "market": "",
    }
