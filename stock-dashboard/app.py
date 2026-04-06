import json
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import yfinance as yf
from pykrx import stock as krx_stock
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import asyncio

app = FastAPI(title="주식 대시보드")
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# 연결된 WebSocket 클라이언트 관리
connected_clients: list[WebSocket] = []

# 인기 종목 기본값
DEFAULT_KR_STOCKS = {
    "005930": "삼성전자",
    "000660": "SK하이닉스",
    "035420": "NAVER",
    "035720": "카카오",
    "051910": "LG화학",
    "006400": "삼성SDI",
    "068270": "셀트리온",
    "105560": "KB금융",
    "055550": "신한지주",
    "003670": "포스코퓨처엠",
}

DEFAULT_US_STOCKS = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Alphabet",
    "AMZN": "Amazon",
    "NVDA": "NVIDIA",
    "TSLA": "Tesla",
    "META": "Meta",
    "JPM": "JPMorgan",
    "V": "Visa",
    "TSM": "TSMC",
}


def get_kr_stock_data():
    """한국 주식 데이터 조회"""
    today = datetime.now().strftime("%Y%m%d")
    results = []
    try:
        for code, name in DEFAULT_KR_STOCKS.items():
            try:
                df = krx_stock.get_market_ohlcv(today, today, code)
                if df.empty:
                    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y%m%d")
                    df = krx_stock.get_market_ohlcv(yesterday, yesterday, code)
                if not df.empty:
                    row = df.iloc[-1]
                    prev_close = row["시가"] if row["등락률"] == 0 else row["종가"] / (1 + row["등락률"] / 100)
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
            except Exception:
                results.append({
                    "symbol": code,
                    "name": name,
                    "price": 0,
                    "change": 0,
                    "volume": 0,
                    "high": 0,
                    "low": 0,
                    "open": 0,
                    "market": "KR",
                    "currency": "₩",
                })
    except Exception:
        pass
    return results


def get_us_stock_data():
    """미국 주식 데이터 조회"""
    results = []
    symbols = list(DEFAULT_US_STOCKS.keys())
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
                results.append({
                    "symbol": symbol,
                    "name": DEFAULT_US_STOCKS[symbol],
                    "price": 0,
                    "change": 0,
                    "volume": 0,
                    "high": 0,
                    "low": 0,
                    "open": 0,
                    "market": "US",
                    "currency": "$",
                })
    except Exception:
        pass
    return results


def get_kr_chart_data(code: str, days: int = 30):
    """한국 주식 차트 데이터"""
    end = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
    try:
        df = krx_stock.get_market_ohlcv(start, end, code)
        return [
            {"date": d.strftime("%Y-%m-%d"), "close": int(row["종가"]), "volume": int(row["거래량"])}
            for d, row in df.iterrows()
        ]
    except Exception:
        return []


def get_us_chart_data(symbol: str, days: int = 30):
    """미국 주식 차트 데이터"""
    try:
        ticker = yf.Ticker(symbol)
        period = "1mo" if days <= 30 else "3mo" if days <= 90 else "1y"
        df = ticker.history(period=period)
        return [
            {"date": d.strftime("%Y-%m-%d"), "close": round(row["Close"], 2), "volume": int(row["Volume"])}
            for d, row in df.iterrows()
        ]
    except Exception:
        return []


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/api/stocks")
async def get_stocks(market: str = "all"):
    data = []
    if market in ("all", "kr"):
        data.extend(get_kr_stock_data())
    if market in ("all", "us"):
        data.extend(get_us_stock_data())
    return {"stocks": data, "updated_at": datetime.now().isoformat()}


@app.get("/api/chart/{market}/{symbol}")
async def get_chart(market: str, symbol: str, days: int = 30):
    if market == "kr":
        data = get_kr_chart_data(symbol, days)
    else:
        data = get_us_chart_data(symbol, days)
    return {"chart": data}


@app.get("/api/search")
async def search_stock(q: str):
    """종목 검색"""
    results = []
    # 한국 종목 검색
    for code, name in DEFAULT_KR_STOCKS.items():
        if q.lower() in name.lower() or q in code:
            results.append({"symbol": code, "name": name, "market": "KR"})
    # 미국 종목 검색
    for symbol, name in DEFAULT_US_STOCKS.items():
        if q.lower() in name.lower() or q.upper() in symbol:
            results.append({"symbol": symbol, "name": name, "market": "US"})
    # yfinance로 추가 검색
    if not results:
        try:
            ticker = yf.Ticker(q.upper())
            info = ticker.fast_info
            if info.last_price:
                results.append({"symbol": q.upper(), "name": q.upper(), "market": "US"})
        except Exception:
            pass
    return {"results": results}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "refresh":
                market = msg.get("market", "all")
                stocks = []
                if market in ("all", "kr"):
                    stocks.extend(get_kr_stock_data())
                if market in ("all", "us"):
                    stocks.extend(get_us_stock_data())
                await websocket.send_json({
                    "type": "update",
                    "stocks": stocks,
                    "updated_at": datetime.now().isoformat(),
                })
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
