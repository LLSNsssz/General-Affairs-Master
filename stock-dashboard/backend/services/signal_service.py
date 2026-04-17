"""High-level signal service with SQLite and Supabase-backed caching."""

import json
from datetime import datetime, timedelta, timezone

from config import DATABASE_MODE, SIGNAL_CACHE_TTL_MINUTES
from database import get_sqlite_conn, get_supabase
from services.investor_flow import get_investor_flow_score
from services.news_scraper import get_news_sentiment
from services.signal_engine import compute_signal


def get_signal(symbol: str, market: str, use_cache: bool = True) -> dict:
    """Return a detailed signal, using cache when available."""
    market = market.upper()

    if use_cache:
        cached_signal = get_cached_signal(symbol, market)
        if cached_signal is not None:
            return cached_signal

    news_score = get_news_sentiment(symbol, market, limit=5)
    investor_score = get_investor_flow_score(symbol) if market == "KR" else 0.0
    signal = compute_signal(symbol, market, news_score, investor_score)

    if use_cache:
        cache_signal(symbol, market, signal)

    return signal


def get_cached_signal(symbol: str, market: str) -> dict | None:
    """Load a cached signal when it is still fresh."""
    row = _get_cached_row(symbol, market)
    if row is None or _is_cache_expired(row["computed_at"]):
        return None

    payload = _load_cached_details(row["details_json"])
    payload.setdefault("signal_level", row["signal_level"])
    payload.setdefault("signal_score", row["signal_score"])
    payload.setdefault("is_capitulation", bool(row["is_capitulation"]))
    payload.setdefault("breakdown", {})
    payload.setdefault("indicators", {})
    return payload


def cache_signal(symbol: str, market: str, signal: dict) -> None:
    """Store the latest signal payload in the active backend."""
    if DATABASE_MODE == "sqlite":
        with get_sqlite_conn() as conn:
            conn.execute(
                """
                INSERT INTO signal_cache (
                    symbol,
                    market,
                    signal_level,
                    signal_score,
                    is_capitulation,
                    details_json,
                    computed_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(symbol, market) DO UPDATE SET
                    signal_level = excluded.signal_level,
                    signal_score = excluded.signal_score,
                    is_capitulation = excluded.is_capitulation,
                    details_json = excluded.details_json,
                    computed_at = CURRENT_TIMESTAMP
                """,
                (
                    symbol,
                    market,
                    signal["signal_level"],
                    signal["signal_score"],
                    int(signal["is_capitulation"]),
                    json.dumps(signal),
                ),
            )
        return

    get_supabase().table("signal_cache").upsert(
        {
            "symbol": symbol,
            "market": market,
            "signal_level": signal["signal_level"],
            "signal_score": signal["signal_score"],
            "is_capitulation": bool(signal["is_capitulation"]),
            "details_json": signal,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="symbol,market",
    ).execute()


def _get_cached_row(symbol: str, market: str):
    if DATABASE_MODE == "sqlite":
        with get_sqlite_conn() as conn:
            return conn.execute(
                """
                SELECT signal_level, signal_score, is_capitulation, details_json, computed_at
                FROM signal_cache
                WHERE symbol = ? AND market = ?
                """,
                (symbol, market),
            ).fetchone()

    response = (
        get_supabase()
        .table("signal_cache")
        .select("signal_level, signal_score, is_capitulation, details_json, computed_at")
        .eq("symbol", symbol)
        .eq("market", market)
        .limit(1)
        .execute()
    )
    rows = getattr(response, "data", None) or []
    return rows[0] if rows else None


def _is_cache_expired(computed_at: str) -> bool:
    try:
        computed_at_dt = datetime.fromisoformat(str(computed_at).replace("Z", "+00:00"))
    except ValueError:
        return True

    if computed_at_dt.tzinfo is None:
        computed_at_dt = computed_at_dt.replace(tzinfo=timezone.utc)

    return datetime.now(timezone.utc) - computed_at_dt.astimezone(timezone.utc) > timedelta(
        minutes=SIGNAL_CACHE_TTL_MINUTES
    )


def _load_cached_details(details_json: str | dict | None) -> dict:
    if not details_json:
        return {}

    if isinstance(details_json, dict):
        return details_json

    try:
        payload = json.loads(details_json)
    except json.JSONDecodeError:
        return {}

    return payload if isinstance(payload, dict) else {}
