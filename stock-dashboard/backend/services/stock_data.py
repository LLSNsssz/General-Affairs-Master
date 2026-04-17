"""Stock price data service backed by yfinance and pykrx."""

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import datetime, timedelta
from threading import Lock
import time

import pandas as pd
import yfinance as yf

from config import (
    DEFAULT_KR_STOCKS,
    DEFAULT_US_STOCKS,
    MARKET_DATA_CACHE_TTL_SECONDS,
    MARKET_DATA_STALE_TTL_SECONDS,
    YFINANCE_TIMEOUT_SECONDS,
)
from pykrx_compat import call_quietly, krx_stock

KRX_LOOKBACK_DAYS = 10
_YFINANCE_EXECUTOR = ThreadPoolExecutor(max_workers=4)
_snapshot_cache: dict[str, dict] = {}
_snapshot_cache_lock = Lock()


def find_latest_kr_trading_day(symbol: str, max_lookback_days: int = KRX_LOOKBACK_DAYS) -> datetime | None:
    """Return the latest trading day for a KR stock symbol."""
    reference_day = datetime.now()
    for offset in range(max_lookback_days + 1):
        target_day = reference_day - timedelta(days=offset)
        date_str = target_day.strftime("%Y%m%d")
        try:
            df = call_quietly(krx_stock.get_market_ohlcv, date_str, date_str, symbol)
        except Exception:
            continue
        if not df.empty:
            return target_day
    return None


def get_kr_stock_data(force_refresh: bool = False) -> list[dict]:
    """Fetch latest KR stock snapshots."""
    return _list_snapshots(DEFAULT_KR_STOCKS, "KR", force_refresh=force_refresh)


def get_us_stock_data(force_refresh: bool = False) -> list[dict]:
    """Fetch latest US stock snapshots."""
    return _list_snapshots(DEFAULT_US_STOCKS, "US", force_refresh=force_refresh)


def get_ohlcv_dataframe(symbol: str, market: str, days: int = 60) -> pd.DataFrame:
    """Return OHLCV data normalized for technical calculations."""
    if market == "KR":
        latest_day = find_latest_kr_trading_day(symbol)
        if latest_day is None:
            return pd.DataFrame()

        end = latest_day.strftime("%Y%m%d")
        buffer_days = max(days * 2, days + 14)
        start = (latest_day - timedelta(days=buffer_days)).strftime("%Y%m%d")
        try:
            df = call_quietly(krx_stock.get_market_ohlcv, start, end, symbol)
            return _normalize_kr_ohlcv(df)
        except Exception:
            return pd.DataFrame()

    try:
        ticker = yf.Ticker(symbol)
        period = "1mo" if days <= 30 else "3mo" if days <= 90 else "1y"
        df = ticker.history(period=period)
        return df
    except Exception:
        return pd.DataFrame()


def get_chart_data(symbol: str, market: str, days: int = 30) -> list[dict]:
    """Return chart-ready OHLCV rows."""
    df = get_ohlcv_dataframe(symbol, market, days)
    if df.empty:
        return []

    return [
        {
            "date": date.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        }
        for date, row in df.iterrows()
    ]


def get_stock_snapshot(symbol: str, market: str, name: str | None = None, force_refresh: bool = False) -> dict:
    """Return a single-stock snapshot without fetching the whole default list."""
    normalized = _normalize_request(symbol, market, name)
    key = _snapshot_key(normalized["symbol"], normalized["market"])
    return get_stock_snapshots([normalized], force_refresh=force_refresh).get(
        key,
        _empty_stock(
            normalized["symbol"],
            normalized["name"],
            normalized["market"],
            _default_currency(normalized["market"]),
        ),
    )


def get_stock_snapshots(
    requests: list[dict | tuple[str, str, str | None]],
    force_refresh: bool = False,
) -> dict[str, dict]:
    """Return a keyed snapshot map for the requested symbols."""
    normalized_requests = _dedupe_requests(requests)
    if not normalized_requests:
        return {}

    snapshots: dict[str, dict] = {}
    pending_kr: list[dict] = []
    pending_us: list[dict] = []

    for request in normalized_requests:
        key = _snapshot_key(request["symbol"], request["market"])
        if not force_refresh:
            cached = _get_cached_snapshot(key)
            if cached is not None:
                snapshots[key] = cached
                continue

        if request["market"] == "KR":
            pending_kr.append(request)
            continue

        if request["market"] == "US":
            pending_us.append(request)
            continue

        snapshots[key] = _empty_stock(
            request["symbol"],
            request["name"],
            request["market"],
            _default_currency(request["market"]),
        )

    if pending_kr:
        snapshots.update(_get_kr_snapshots_batch(pending_kr))

    if pending_us:
        snapshots.update(_get_us_snapshots_batch(pending_us))

    return snapshots


def search_stocks(query: str) -> list[dict]:
    """Search built-in KR and US symbols, then fall back to a timed US quote lookup."""
    results = []
    lowered_query = query.lower()

    for code, name in DEFAULT_KR_STOCKS.items():
        if lowered_query in name.lower() or lowered_query in code:
            results.append({"symbol": code, "name": name, "market": "KR"})

    for symbol, name in DEFAULT_US_STOCKS.items():
        if lowered_query in name.lower() or query.upper() in symbol:
            results.append({"symbol": symbol, "name": name, "market": "US"})

    if not results:
        candidate = query.upper().strip()
        if candidate:
            snapshot = get_stock_snapshot(candidate, "US", candidate)
            if snapshot.get("price", 0) > 0:
                results.append({"symbol": candidate, "name": candidate, "market": "US"})

    return results


def _list_snapshots(symbol_map: dict[str, str], market: str, force_refresh: bool = False) -> list[dict]:
    requests = [
        {"symbol": symbol, "market": market, "name": name}
        for symbol, name in symbol_map.items()
    ]
    snapshot_map = get_stock_snapshots(requests, force_refresh=force_refresh)
    return [
        snapshot_map.get(
            _snapshot_key(symbol, market),
            _empty_stock(symbol, name, market, _default_currency(market)),
        )
        for symbol, name in symbol_map.items()
    ]


def _get_kr_daily_snapshot(symbol: str, max_lookback_days: int = KRX_LOOKBACK_DAYS) -> pd.DataFrame:
    latest_day = find_latest_kr_trading_day(symbol, max_lookback_days=max_lookback_days)
    if latest_day is None:
        return pd.DataFrame()

    date_str = latest_day.strftime("%Y%m%d")
    try:
        return call_quietly(krx_stock.get_market_ohlcv, date_str, date_str, symbol)
    except Exception:
        return pd.DataFrame()


def _get_single_kr_stock(symbol: str, name: str) -> dict:
    try:
        df = _get_kr_daily_snapshot(symbol)
        if not df.empty:
            row = df.iloc[-1]
            return {
                "symbol": symbol,
                "name": name,
                "price": int(row["종가"]),
                "change": round(float(row["등락률"]), 2),
                "volume": int(row["거래량"]),
                "high": int(row["고가"]),
                "low": int(row["저가"]),
                "open": int(row["시가"]),
                "market": "KR",
                "currency": "₩",
            }
    except Exception:
        pass
    return _empty_stock(symbol, name, "KR", "₩")


def _get_kr_snapshots_batch(requests: list[dict]) -> dict[str, dict]:
    stale_map = {
        _snapshot_key(request["symbol"], request["market"]): _get_cached_snapshot(
            _snapshot_key(request["symbol"], request["market"]),
            allow_stale=True,
        )
        for request in requests
    }
    rows_by_symbol = _fetch_kr_market_rows()
    results = {}

    if not rows_by_symbol:
        for request in requests:
            key = _snapshot_key(request["symbol"], request["market"])
            snapshot = _get_single_kr_stock(request["symbol"], request["name"])
            if snapshot.get("price", 0) <= 0:
                snapshot = stale_map.get(key) or snapshot
            _set_cached_snapshot(key, snapshot)
            results[key] = snapshot
        return results

    for request in requests:
        key = _snapshot_key(request["symbol"], request["market"])
        row = rows_by_symbol.get(request["symbol"])
        if row is not None:
            snapshot = _build_kr_snapshot_from_row(request["symbol"], request["name"], row)
        else:
            snapshot = stale_map.get(key) or _empty_stock(
                request["symbol"],
                request["name"],
                "KR",
                "₩",
            )

        _set_cached_snapshot(key, snapshot)
        results[key] = snapshot

    return results


def _fetch_kr_market_rows(max_lookback_days: int = KRX_LOOKBACK_DAYS) -> dict[str, pd.Series]:
    reference_day = datetime.now()
    for offset in range(max_lookback_days + 1):
        target_day = reference_day - timedelta(days=offset)
        date_str = target_day.strftime("%Y%m%d")
        frame = _fetch_kr_market_frame(date_str)
        if not frame.empty:
            return _index_kr_market_frame(frame)
    return {}


def _fetch_kr_market_frame(date_str: str) -> pd.DataFrame:
    for market in ("ALL", "KOSPI", "KOSDAQ"):
        try:
            frame = call_quietly(krx_stock.get_market_ohlcv_by_ticker, date_str, market=market)
        except Exception:
            continue
        if not frame.empty:
            return frame

    frames = []
    for market in ("KOSPI", "KOSDAQ"):
        try:
            frame = call_quietly(krx_stock.get_market_ohlcv_by_ticker, date_str, market=market)
        except Exception:
            continue
        if not frame.empty:
            frames.append(frame)

    if not frames:
        return pd.DataFrame()

    return pd.concat(frames)


def _index_kr_market_frame(frame: pd.DataFrame) -> dict[str, pd.Series]:
    indexed = {}
    for symbol, row in frame.iterrows():
        indexed[str(symbol).zfill(6)] = row
    return indexed


def _build_kr_snapshot_from_row(symbol: str, name: str, row: pd.Series) -> dict:
    return {
        "symbol": symbol,
        "name": name,
        "price": int(_coerce_float(row.get("종가"), 0)),
        "change": round(_coerce_float(row.get("등락률"), 0), 2),
        "volume": int(_coerce_float(row.get("거래량"), 0)),
        "high": int(_coerce_float(row.get("고가"), 0)),
        "low": int(_coerce_float(row.get("저가"), 0)),
        "open": int(_coerce_float(row.get("시가"), 0)),
        "market": "KR",
        "currency": "₩",
    }


def _get_us_snapshots_batch(requests: list[dict]) -> dict[str, dict]:
    stale_map = {
        _snapshot_key(request["symbol"], request["market"]): _get_cached_snapshot(
            _snapshot_key(request["symbol"], request["market"]),
            allow_stale=True,
        )
        for request in requests
    }
    symbols = [request["symbol"] for request in requests]
    downloaded = _download_us_ohlcv(symbols)
    results = {}

    for request in requests:
        key = _snapshot_key(request["symbol"], request["market"])
        frame = _extract_us_symbol_frame(downloaded, request["symbol"], multi_symbol=len(symbols) > 1)

        if not frame.empty:
            snapshot = _build_us_snapshot(frame, request["symbol"], request["name"])
        else:
            snapshot = None

        if snapshot is None:
            snapshot = stale_map.get(key) or _empty_stock(
                request["symbol"],
                request["name"],
                "US",
                "$",
            )

        _set_cached_snapshot(key, snapshot)
        results[key] = snapshot

    return results


def _download_us_ohlcv(symbols: list[str]) -> pd.DataFrame:
    unique_symbols = [symbol for symbol in dict.fromkeys(symbols) if symbol]
    if not unique_symbols:
        return pd.DataFrame()

    future = _YFINANCE_EXECUTOR.submit(
        yf.download,
        " ".join(unique_symbols),
        period="5d",
        interval="1d",
        group_by="ticker" if len(unique_symbols) > 1 else "column",
        auto_adjust=False,
        progress=False,
        threads=len(unique_symbols) > 1,
        timeout=YFINANCE_TIMEOUT_SECONDS,
    )

    try:
        data = future.result(timeout=YFINANCE_TIMEOUT_SECONDS + 0.5)
    except TimeoutError:
        return pd.DataFrame()
    except Exception:
        return pd.DataFrame()

    return data if isinstance(data, pd.DataFrame) else pd.DataFrame()


def _extract_us_symbol_frame(df: pd.DataFrame, symbol: str, multi_symbol: bool) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()

    if not multi_symbol:
        frame = df.copy()
        if isinstance(frame.columns, pd.MultiIndex):
            try:
                frame = frame.xs(symbol, axis=1, level=0)
            except Exception:
                return pd.DataFrame()
        return frame.dropna(how="all")

    if not isinstance(df.columns, pd.MultiIndex):
        return pd.DataFrame()

    try:
        frame = df.xs(symbol, axis=1, level=0)
    except Exception:
        return pd.DataFrame()

    return frame.dropna(how="all")


def _build_us_snapshot(frame: pd.DataFrame, symbol: str, name: str) -> dict | None:
    close_column = frame.get("Close")
    if close_column is None:
        return None

    close_series = pd.to_numeric(close_column, errors="coerce").dropna()
    if close_series.empty:
        return None

    price = round(float(close_series.iloc[-1]), 2)
    prev_close = round(float(close_series.iloc[-2]), 2) if len(close_series) > 1 else price
    latest = frame.iloc[-1]
    high = round(_coerce_float(latest.get("High"), price), 2)
    low = round(_coerce_float(latest.get("Low"), price), 2)
    open_price = round(_coerce_float(latest.get("Open"), price), 2)
    volume = int(_coerce_float(latest.get("Volume"), 0))
    change = round((price - prev_close) / prev_close * 100, 2) if prev_close else 0

    return {
        "symbol": symbol,
        "name": name,
        "price": price,
        "change": change,
        "volume": volume,
        "high": high,
        "low": low,
        "open": open_price,
        "market": "US",
        "currency": "$",
    }


def _dedupe_requests(requests: list[dict | tuple[str, str, str | None]]) -> list[dict]:
    deduped = []
    seen = set()

    for request in requests:
        normalized = _normalize_request(*request) if isinstance(request, tuple) else _normalize_request(
            request.get("symbol", ""),
            request.get("market", ""),
            request.get("name"),
        )
        key = _snapshot_key(normalized["symbol"], normalized["market"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)

    return deduped


def _normalize_request(symbol: str, market: str, name: str | None = None) -> dict:
    normalized_symbol = str(symbol or "").upper()
    normalized_market = str(market or "").upper()
    normalized_name = str(name or normalized_symbol)
    return {
        "symbol": normalized_symbol,
        "market": normalized_market,
        "name": normalized_name,
    }


def _snapshot_key(symbol: str, market: str) -> str:
    return f"{market}:{symbol}"


def _get_cached_snapshot(key: str, allow_stale: bool = False) -> dict | None:
    now = time.time()
    max_age = MARKET_DATA_STALE_TTL_SECONDS if allow_stale else MARKET_DATA_CACHE_TTL_SECONDS

    with _snapshot_cache_lock:
        cached = _snapshot_cache.get(key)

    if not cached:
        return None

    age = now - cached["timestamp"]
    if age > max_age:
        return None

    return dict(cached["snapshot"])


def _set_cached_snapshot(key: str, snapshot: dict) -> None:
    with _snapshot_cache_lock:
        _snapshot_cache[key] = {
            "timestamp": time.time(),
            "snapshot": dict(snapshot),
        }


def _coerce_float(value, default: float) -> float:
    try:
        if pd.isna(value):
            return default
        return float(value)
    except Exception:
        return default


def _normalize_kr_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    normalized = df.rename(
        columns={
            "시가": "Open",
            "고가": "High",
            "저가": "Low",
            "종가": "Close",
            "거래량": "Volume",
        }
    ).sort_index()
    return normalized


def _default_currency(market: str) -> str:
    return "₩" if market == "KR" else "$"


def _empty_stock(symbol: str, name: str, market: str, currency: str) -> dict:
    return {
        "symbol": symbol,
        "name": name,
        "price": 0,
        "change": 0,
        "volume": 0,
        "high": 0,
        "low": 0,
        "open": 0,
        "market": market,
        "currency": currency,
    }
