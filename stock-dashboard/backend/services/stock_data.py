"""주식 시세 데이터 서비스 (yfinance + pykrx)"""

from datetime import datetime, timedelta
import yfinance as yf
from pykrx import stock as krx_stock
import pandas as pd
from config import DEFAULT_KR_STOCKS, DEFAULT_US_STOCKS


def get_kr_stock_data() -> list[dict]:
    """한국 주식 시세 조회"""
    today = datetime.now().strftime("%Y%m%d")
    results = []
    for code, name in DEFAULT_KR_STOCKS.items():
        try:
            df = krx_stock.get_market_ohlcv(today, today, code)
            if df.empty:
                yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y%m%d")
                df = krx_stock.get_market_ohlcv(yesterday, yesterday, code)
            if not df.empty:
                row = df.iloc[-1]
                results.append({
                    "symbol": code,
                    "name": name,
                    "price": int(row["종가"]),
                    "change": round(row["등락률"], 2),
                    "volume": int(row["거래량"]),
                    "high": int(row["고가"]),
                    "low": int(row["저가"]),
                    "open": int(row["시가"]),
                    "market": "KR",
                    "currency": "₩",
                })
                continue
        except Exception:
            pass
        results.append(_empty_stock(code, name, "KR", "₩"))
    return results


def get_us_stock_data() -> list[dict]:
    """미국 주식 시세 조회"""
    symbols = list(DEFAULT_US_STOCKS.keys())
    results = []
    try:
        tickers = yf.Tickers(" ".join(symbols))
        for symbol in symbols:
            try:
                ticker = tickers.tickers[symbol]
                info = ticker.fast_info
                price = round(info.last_price, 2)
                prev = round(info.previous_close, 2)
                change = round((price - prev) / prev * 100, 2) if prev else 0

                hist = ticker.history(period="1d")
                high = round(hist["High"].iloc[-1], 2) if not hist.empty else price
                low = round(hist["Low"].iloc[-1], 2) if not hist.empty else price
                open_price = round(hist["Open"].iloc[-1], 2) if not hist.empty else price
                volume = int(hist["Volume"].iloc[-1]) if not hist.empty else 0

                results.append({
                    "symbol": symbol,
                    "name": DEFAULT_US_STOCKS[symbol],
                    "price": price,
                    "change": change,
                    "volume": volume,
                    "high": high,
                    "low": low,
                    "open": open_price,
                    "market": "US",
                    "currency": "$",
                })
            except Exception:
                results.append(_empty_stock(symbol, DEFAULT_US_STOCKS[symbol], "US", "$"))
    except Exception:
        for symbol, name in DEFAULT_US_STOCKS.items():
            results.append(_empty_stock(symbol, name, "US", "$"))
    return results


def get_ohlcv_dataframe(symbol: str, market: str, days: int = 60) -> pd.DataFrame:
    """OHLCV 데이터를 DataFrame으로 반환 (기술적 지표 계산용)"""
    if market == "KR":
        end = datetime.now().strftime("%Y%m%d")
        start = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
        try:
            df = krx_stock.get_market_ohlcv(start, end, symbol)
            df = df.rename(columns={
                "시가": "Open", "고가": "High", "저가": "Low",
                "종가": "Close", "거래량": "Volume",
            })
            return df
        except Exception:
            return pd.DataFrame()
    else:
        try:
            ticker = yf.Ticker(symbol)
            period = "1mo" if days <= 30 else "3mo" if days <= 90 else "1y"
            df = ticker.history(period=period)
            return df
        except Exception:
            return pd.DataFrame()


def get_chart_data(symbol: str, market: str, days: int = 30) -> list[dict]:
    """차트용 데이터"""
    df = get_ohlcv_dataframe(symbol, market, days)
    if df.empty:
        return []
    return [
        {
            "date": d.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        }
        for d, row in df.iterrows()
    ]


def search_stocks(query: str) -> list[dict]:
    """종목 검색"""
    results = []
    q = query.lower()
    for code, name in DEFAULT_KR_STOCKS.items():
        if q in name.lower() or q in code:
            results.append({"symbol": code, "name": name, "market": "KR"})
    for symbol, name in DEFAULT_US_STOCKS.items():
        if q in name.lower() or q.upper() in symbol:
            results.append({"symbol": symbol, "name": name, "market": "US"})
    if not results:
        try:
            ticker = yf.Ticker(query.upper())
            info = ticker.fast_info
            if info.last_price:
                results.append({"symbol": query.upper(), "name": query.upper(), "market": "US"})
        except Exception:
            pass
    return results


def _empty_stock(symbol: str, name: str, market: str, currency: str) -> dict:
    return {
        "symbol": symbol, "name": name, "price": 0, "change": 0,
        "volume": 0, "high": 0, "low": 0, "open": 0,
        "market": market, "currency": currency,
    }
