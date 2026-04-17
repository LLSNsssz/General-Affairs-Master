"""Portfolio service for SQLite and Supabase backends."""

from config import DATABASE_MODE
from database import get_sqlite_conn, get_supabase
from services.stock_data import get_stock_snapshots


def get_holdings(user_id: str) -> list[dict]:
    """Return holdings for the given user."""
    if DATABASE_MODE == "sqlite":
        return _sqlite_get_holdings(user_id)
    return _supabase_get_holdings(user_id)


def upsert_holding(
    user_id: str,
    symbol: str,
    market: str,
    name: str,
    quantity: float,
    avg_price: float,
    currency: str,
) -> dict:
    """Add or merge a holding using weighted average cost."""
    symbol, market, quantity, avg_price, currency = _normalize_trade_inputs(
        symbol, market, quantity, avg_price, currency
    )

    if DATABASE_MODE == "sqlite":
        return _sqlite_upsert_holding(user_id, symbol, market, name, quantity, avg_price, currency)
    return _supabase_upsert_holding(user_id, symbol, market, name, quantity, avg_price, currency)


def sell_holding(user_id: str, symbol: str, market: str, quantity: float, price: float, currency: str) -> dict:
    """Sell part or all of a holding."""
    symbol, market, quantity, price, currency = _normalize_trade_inputs(symbol, market, quantity, price, currency)

    if DATABASE_MODE == "sqlite":
        return _sqlite_sell_holding(user_id, symbol, market, quantity, price, currency)
    return _supabase_sell_holding(user_id, symbol, market, quantity, price, currency)


def delete_holding(user_id: str, symbol: str, market: str) -> dict:
    """Delete a holding."""
    symbol = symbol.upper()
    market = market.upper()

    if DATABASE_MODE == "sqlite":
        return _sqlite_delete_holding(user_id, symbol, market)
    return _supabase_delete_holding(user_id, symbol, market)


def get_transactions(user_id: str, limit: int = 50) -> list[dict]:
    """Return transactions for the given user."""
    if DATABASE_MODE == "sqlite":
        return _sqlite_get_transactions(user_id, limit)
    return _supabase_get_transactions(user_id, limit)


def get_portfolio_summary(user_id: str, force_refresh: bool = False) -> dict:
    """Return a portfolio summary with realtime PnL."""
    holdings = get_holdings(user_id)
    if not holdings:
        return {
            "holdings": [],
            "total_invested": 0,
            "total_current": 0,
            "total_pnl": 0,
            "total_pnl_pct": 0,
        }

    price_map = _get_price_map(holdings, force_refresh=force_refresh)
    enriched = []
    total_invested = 0.0
    total_current = 0.0

    for holding in holdings:
        normalized = _normalize_holding_record(holding)
        current_price = price_map.get(f"{normalized['market']}:{normalized['symbol']}", 0)
        invested = normalized["quantity"] * normalized["avg_price"]
        current_value = normalized["quantity"] * current_price
        pnl = current_value - invested
        pnl_pct = round((pnl / invested * 100), 2) if invested > 0 else 0

        enriched.append(
            {
                **normalized,
                "current_price": round(current_price, 2),
                "invested": round(invested, 2),
                "current_value": round(current_value, 2),
                "pnl": round(pnl, 2),
                "pnl_pct": pnl_pct,
            }
        )

        total_invested += invested
        total_current += current_value

    total_pnl = total_current - total_invested
    total_pnl_pct = round((total_pnl / total_invested * 100), 2) if total_invested > 0 else 0

    return {
        "holdings": enriched,
        "total_invested": round(total_invested, 2),
        "total_current": round(total_current, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": total_pnl_pct,
    }


def _sqlite_get_holdings(user_id: str) -> list[dict]:
    with get_sqlite_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM holdings WHERE user_id = ? ORDER BY market, name",
            (user_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def _sqlite_upsert_holding(
    user_id: str,
    symbol: str,
    market: str,
    name: str,
    quantity: float,
    avg_price: float,
    currency: str,
) -> dict:
    with get_sqlite_conn() as conn:
        existing = conn.execute(
            "SELECT quantity, avg_price FROM holdings WHERE user_id = ? AND symbol = ? AND market = ?",
            (user_id, symbol, market),
        ).fetchone()

        if existing:
            new_qty, new_avg = _merge_position(existing["quantity"], existing["avg_price"], quantity, avg_price)
            conn.execute(
                """
                UPDATE holdings
                SET quantity = ?, avg_price = ?, name = ?, currency = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND symbol = ? AND market = ?
                """,
                (new_qty, new_avg, name, currency, user_id, symbol, market),
            )
        else:
            conn.execute(
                """
                INSERT INTO holdings (user_id, symbol, market, name, quantity, avg_price, currency)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, symbol, market, name, quantity, avg_price, currency),
            )

        conn.execute(
            """
            INSERT INTO transactions (user_id, symbol, market, tx_type, quantity, price, currency)
            VALUES (?, ?, ?, 'BUY', ?, ?, ?)
            """,
            (user_id, symbol, market, quantity, avg_price, currency),
        )

    return {"status": "ok", "symbol": symbol}


def _sqlite_sell_holding(
    user_id: str,
    symbol: str,
    market: str,
    quantity: float,
    price: float,
    currency: str,
) -> dict:
    with get_sqlite_conn() as conn:
        existing = conn.execute(
            "SELECT quantity FROM holdings WHERE user_id = ? AND symbol = ? AND market = ?",
            (user_id, symbol, market),
        ).fetchone()

        if not existing:
            return {"status": "error", "message": "Holding not found"}

        if quantity > existing["quantity"]:
            return {"status": "error", "message": "Sell quantity exceeds holding quantity"}

        new_qty = round(existing["quantity"] - quantity, 4)
        if new_qty == 0:
            conn.execute(
                "DELETE FROM holdings WHERE user_id = ? AND symbol = ? AND market = ?",
                (user_id, symbol, market),
            )
        else:
            conn.execute(
                """
                UPDATE holdings
                SET quantity = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND symbol = ? AND market = ?
                """,
                (new_qty, user_id, symbol, market),
            )

        conn.execute(
            """
            INSERT INTO transactions (user_id, symbol, market, tx_type, quantity, price, currency)
            VALUES (?, ?, ?, 'SELL', ?, ?, ?)
            """,
            (user_id, symbol, market, quantity, price, currency),
        )

    return {"status": "ok", "symbol": symbol}


def _sqlite_delete_holding(user_id: str, symbol: str, market: str) -> dict:
    with get_sqlite_conn() as conn:
        conn.execute(
            "DELETE FROM holdings WHERE user_id = ? AND symbol = ? AND market = ?",
            (user_id, symbol, market),
        )
    return {"status": "ok"}


def _sqlite_get_transactions(user_id: str, limit: int) -> list[dict]:
    with get_sqlite_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM transactions WHERE user_id = ? ORDER BY tx_date DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]


def _supabase_get_holdings(user_id: str) -> list[dict]:
    response = (
        get_supabase()
        .table("holdings")
        .select("*")
        .eq("user_id", user_id)
        .order("market")
        .order("name")
        .execute()
    )
    return getattr(response, "data", None) or []


def _supabase_upsert_holding(
    user_id: str,
    symbol: str,
    market: str,
    name: str,
    quantity: float,
    avg_price: float,
    currency: str,
) -> dict:
    client = get_supabase()
    existing = _supabase_get_single_record("holdings", user_id, symbol, market, columns="id, quantity, avg_price")

    if existing:
        new_qty, new_avg = _merge_position(existing["quantity"], existing["avg_price"], quantity, avg_price)
        (
            client.table("holdings")
            .update(
                {
                    "quantity": new_qty,
                    "avg_price": new_avg,
                    "name": name,
                    "currency": currency,
                }
            )
            .eq("user_id", user_id)
            .eq("symbol", symbol)
            .eq("market", market)
            .execute()
        )
    else:
        client.table("holdings").insert(
            {
                "user_id": user_id,
                "symbol": symbol,
                "market": market,
                "name": name,
                "quantity": quantity,
                "avg_price": avg_price,
                "currency": currency,
            }
        ).execute()

    client.table("transactions").insert(
        {
            "user_id": user_id,
            "symbol": symbol,
            "market": market,
            "tx_type": "BUY",
            "quantity": quantity,
            "price": avg_price,
            "currency": currency,
        }
    ).execute()

    return {"status": "ok", "symbol": symbol}


def _supabase_sell_holding(
    user_id: str,
    symbol: str,
    market: str,
    quantity: float,
    price: float,
    currency: str,
) -> dict:
    client = get_supabase()
    existing = _supabase_get_single_record("holdings", user_id, symbol, market, columns="id, quantity")
    if not existing:
        return {"status": "error", "message": "Holding not found"}

    current_qty = float(existing["quantity"])
    if quantity > current_qty:
        return {"status": "error", "message": "Sell quantity exceeds holding quantity"}

    new_qty = round(current_qty - quantity, 4)
    if new_qty == 0:
        client.table("holdings").delete().eq("user_id", user_id).eq("symbol", symbol).eq("market", market).execute()
    else:
        (
            client.table("holdings")
            .update({"quantity": new_qty})
            .eq("user_id", user_id)
            .eq("symbol", symbol)
            .eq("market", market)
            .execute()
        )

    client.table("transactions").insert(
        {
            "user_id": user_id,
            "symbol": symbol,
            "market": market,
            "tx_type": "SELL",
            "quantity": quantity,
            "price": price,
            "currency": currency,
        }
    ).execute()

    return {"status": "ok", "symbol": symbol}


def _supabase_delete_holding(user_id: str, symbol: str, market: str) -> dict:
    get_supabase().table("holdings").delete().eq("user_id", user_id).eq("symbol", symbol).eq("market", market).execute()
    return {"status": "ok"}


def _supabase_get_transactions(user_id: str, limit: int) -> list[dict]:
    response = (
        get_supabase()
        .table("transactions")
        .select("*")
        .eq("user_id", user_id)
        .order("tx_date", desc=True)
        .limit(limit)
        .execute()
    )
    return getattr(response, "data", None) or []


def _supabase_get_single_record(table: str, user_id: str, symbol: str, market: str, columns: str = "*") -> dict | None:
    response = (
        get_supabase()
        .table(table)
        .select(columns)
        .eq("user_id", user_id)
        .eq("symbol", symbol)
        .eq("market", market)
        .limit(1)
        .execute()
    )
    rows = getattr(response, "data", None) or []
    return rows[0] if rows else None


def _normalize_trade_inputs(
    symbol: str,
    market: str,
    quantity: float,
    price: float,
    currency: str,
) -> tuple[str, str, float, float, str]:
    normalized_symbol = symbol.upper()
    normalized_market = market.upper()
    normalized_quantity = round(float(quantity), 4)
    normalized_price = round(float(price), 2)
    normalized_currency = currency or ("₩" if normalized_market == "KR" else "$")
    return normalized_symbol, normalized_market, normalized_quantity, normalized_price, normalized_currency


def _merge_position(old_qty: float, old_avg: float, quantity: float, avg_price: float) -> tuple[float, float]:
    total_qty = round(float(old_qty) + quantity, 4)
    if total_qty <= 0:
        return 0.0, round(avg_price, 2)

    weighted_avg = ((float(old_avg) * float(old_qty)) + (avg_price * quantity)) / total_qty
    return total_qty, round(weighted_avg, 2)


def _normalize_holding_record(record: dict) -> dict:
    normalized = dict(record)
    normalized["quantity"] = round(float(normalized.get("quantity", 0) or 0), 4)
    normalized["avg_price"] = round(float(normalized.get("avg_price", 0) or 0), 2)
    normalized["symbol"] = str(normalized.get("symbol", "")).upper()
    normalized["market"] = str(normalized.get("market", "")).upper()
    normalized["currency"] = normalized.get("currency") or ("₩" if normalized["market"] == "KR" else "$")
    return normalized


def _get_price_map(holdings: list[dict], force_refresh: bool = False) -> dict:
    """Return latest prices for the user's actual holdings."""
    requests = []
    seen = set()

    for holding in holdings:
        market = str(holding.get("market", "")).upper()
        symbol = str(holding.get("symbol", "")).upper()
        key = f"{market}:{symbol}"
        if key in seen:
            continue
        seen.add(key)
        requests.append(
            {
                "symbol": symbol,
                "market": market,
                "name": str(holding.get("name", "") or symbol),
            }
        )

    snapshot_map = get_stock_snapshots(requests, force_refresh=force_refresh)
    return {key: snapshot.get("price", 0) for key, snapshot in snapshot_map.items()}
