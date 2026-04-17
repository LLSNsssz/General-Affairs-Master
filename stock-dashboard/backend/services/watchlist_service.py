"""Watchlist service for SQLite and Supabase backends."""

from config import DATABASE_MODE
from database import get_sqlite_conn, get_supabase
from services.stock_data import get_stock_snapshots


def get_watchlist(user_id: str, force_refresh: bool = False) -> list[dict]:
    """Return watchlist items enriched with quotes when available."""
    items = _sqlite_get_watchlist(user_id) if DATABASE_MODE == "sqlite" else _supabase_get_watchlist(user_id)
    if not items:
        return []

    quote_map = _get_quote_map(items, force_refresh=force_refresh)
    enriched = []
    for item in items:
        normalized = {
            **item,
            "symbol": str(item.get("symbol", "")).upper(),
            "market": str(item.get("market", "")).upper(),
        }
        quote = quote_map.get(f"{normalized['market']}:{normalized['symbol']}")
        if quote:
            normalized.update(
                {
                    "price": quote["price"],
                    "change": quote["change"],
                    "currency": quote["currency"],
                    "volume": quote["volume"],
                    "high": quote["high"],
                    "low": quote["low"],
                    "open": quote["open"],
                }
            )
        else:
            normalized.update(
                {
                    "price": 0,
                    "change": 0,
                    "currency": "₩" if normalized["market"] == "KR" else "$",
                    "volume": 0,
                    "high": 0,
                    "low": 0,
                    "open": 0,
                }
            )
        enriched.append(normalized)

    return enriched


def add_watchlist_item(user_id: str, symbol: str, market: str, name: str) -> dict:
    """Add or update an item in the user's watchlist."""
    symbol = symbol.upper()
    market = market.upper()

    if DATABASE_MODE == "sqlite":
        return _sqlite_add_watchlist_item(user_id, symbol, market, name)
    return _supabase_add_watchlist_item(user_id, symbol, market, name)


def delete_watchlist_item(user_id: str, symbol: str, market: str) -> dict:
    """Delete an item from the user's watchlist."""
    symbol = symbol.upper()
    market = market.upper()

    if DATABASE_MODE == "sqlite":
        return _sqlite_delete_watchlist_item(user_id, symbol, market)
    return _supabase_delete_watchlist_item(user_id, symbol, market)


def _sqlite_get_watchlist(user_id: str) -> list[dict]:
    with get_sqlite_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM watchlist WHERE user_id = ? ORDER BY market, name",
            (user_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def _sqlite_add_watchlist_item(user_id: str, symbol: str, market: str, name: str) -> dict:
    with get_sqlite_conn() as conn:
        conn.execute(
            """
            INSERT INTO watchlist (user_id, symbol, market, name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, symbol, market) DO UPDATE SET name = excluded.name
            """,
            (user_id, symbol, market, name),
        )
    return {"status": "ok", "symbol": symbol}


def _sqlite_delete_watchlist_item(user_id: str, symbol: str, market: str) -> dict:
    with get_sqlite_conn() as conn:
        conn.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND symbol = ? AND market = ?",
            (user_id, symbol, market),
        )
    return {"status": "ok"}


def _supabase_get_watchlist(user_id: str) -> list[dict]:
    response = (
        get_supabase()
        .table("watchlist")
        .select("*")
        .eq("user_id", user_id)
        .order("market")
        .order("name")
        .execute()
    )
    return getattr(response, "data", None) or []


def _supabase_add_watchlist_item(user_id: str, symbol: str, market: str, name: str) -> dict:
    get_supabase().table("watchlist").upsert(
        {
            "user_id": user_id,
            "symbol": symbol,
            "market": market,
            "name": name,
        },
        on_conflict="user_id,symbol,market",
    ).execute()
    return {"status": "ok", "symbol": symbol}


def _supabase_delete_watchlist_item(user_id: str, symbol: str, market: str) -> dict:
    get_supabase().table("watchlist").delete().eq("user_id", user_id).eq("symbol", symbol).eq("market", market).execute()
    return {"status": "ok"}


def _get_quote_map(items: list[dict], force_refresh: bool = False) -> dict:
    requests = []
    seen = set()

    for item in items:
        market = str(item.get("market", "")).upper()
        symbol = str(item.get("symbol", "")).upper()
        key = f"{market}:{symbol}"
        if key in seen:
            continue
        seen.add(key)
        requests.append(
            {
                "symbol": symbol,
                "market": market,
                "name": str(item.get("name", "") or symbol),
            }
        )

    return get_stock_snapshots(requests, force_refresh=force_refresh)
