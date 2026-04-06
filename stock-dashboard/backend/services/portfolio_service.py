"""포트폴리오 관리 서비스"""

from database import get_sqlite_conn, DATABASE_MODE
from services.stock_data import get_kr_stock_data, get_us_stock_data
from config import DEFAULT_KR_STOCKS, DEFAULT_US_STOCKS


def get_holdings(user_id: str) -> list[dict]:
    """사용자 보유종목 조회"""
    with get_sqlite_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM holdings WHERE user_id = ? ORDER BY market, name",
            (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def upsert_holding(user_id: str, symbol: str, market: str, name: str,
                   quantity: float, avg_price: float, currency: str) -> dict:
    """보유종목 추가/수정 (평단가 가중평균)"""
    with get_sqlite_conn() as conn:
        existing = conn.execute(
            "SELECT quantity, avg_price FROM holdings WHERE user_id = ? AND symbol = ? AND market = ?",
            (user_id, symbol, market)
        ).fetchone()

        if existing:
            old_qty = existing["quantity"]
            old_avg = existing["avg_price"]
            new_qty = old_qty + quantity
            new_avg = ((old_avg * old_qty) + (avg_price * quantity)) / new_qty if new_qty > 0 else avg_price
            conn.execute(
                "UPDATE holdings SET quantity = ?, avg_price = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ? AND market = ?",
                (round(new_qty, 4), round(new_avg, 2), user_id, symbol, market)
            )
        else:
            conn.execute(
                "INSERT INTO holdings (user_id, symbol, market, name, quantity, avg_price, currency) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, symbol, market, name, quantity, avg_price, currency)
            )

        # 거래 기록 추가
        conn.execute(
            "INSERT INTO transactions (user_id, symbol, market, tx_type, quantity, price, currency) VALUES (?, ?, ?, 'BUY', ?, ?, ?)",
            (user_id, symbol, market, quantity, avg_price, currency)
        )

        return {"status": "ok", "symbol": symbol}


def sell_holding(user_id: str, symbol: str, market: str, quantity: float, price: float, currency: str) -> dict:
    """매도"""
    with get_sqlite_conn() as conn:
        existing = conn.execute(
            "SELECT quantity FROM holdings WHERE user_id = ? AND symbol = ? AND market = ?",
            (user_id, symbol, market)
        ).fetchone()

        if not existing:
            return {"status": "error", "message": "보유종목이 없습니다"}

        new_qty = existing["quantity"] - quantity
        if new_qty <= 0:
            conn.execute(
                "DELETE FROM holdings WHERE user_id = ? AND symbol = ? AND market = ?",
                (user_id, symbol, market)
            )
        else:
            conn.execute(
                "UPDATE holdings SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND symbol = ? AND market = ?",
                (round(new_qty, 4), user_id, symbol, market)
            )

        conn.execute(
            "INSERT INTO transactions (user_id, symbol, market, tx_type, quantity, price, currency) VALUES (?, ?, ?, 'SELL', ?, ?, ?)",
            (user_id, symbol, market, quantity, price, currency)
        )

        return {"status": "ok", "symbol": symbol}


def delete_holding(user_id: str, symbol: str, market: str) -> dict:
    """보유종목 삭제"""
    with get_sqlite_conn() as conn:
        conn.execute(
            "DELETE FROM holdings WHERE user_id = ? AND symbol = ? AND market = ?",
            (user_id, symbol, market)
        )
        return {"status": "ok"}


def get_transactions(user_id: str, limit: int = 50) -> list[dict]:
    """매매 기록 조회"""
    with get_sqlite_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM transactions WHERE user_id = ? ORDER BY tx_date DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
        return [dict(r) for r in rows]


def get_portfolio_summary(user_id: str) -> dict:
    """포트폴리오 요약 (실시간 손익 포함)"""
    holdings = get_holdings(user_id)
    if not holdings:
        return {"holdings": [], "total_invested": 0, "total_current": 0, "total_pnl": 0, "total_pnl_pct": 0}

    # 현재 시세 가져오기
    price_map = _get_price_map()

    enriched = []
    total_invested = 0
    total_current = 0

    for h in holdings:
        current_price = price_map.get(f"{h['market']}:{h['symbol']}", 0)
        invested = h["quantity"] * h["avg_price"]
        current_val = h["quantity"] * current_price
        pnl = current_val - invested
        pnl_pct = round((pnl / invested * 100), 2) if invested > 0 else 0

        enriched.append({
            **h,
            "current_price": current_price,
            "invested": round(invested, 2),
            "current_value": round(current_val, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": pnl_pct,
        })

        total_invested += invested
        total_current += current_val

    total_pnl = total_current - total_invested
    total_pnl_pct = round((total_pnl / total_invested * 100), 2) if total_invested > 0 else 0

    return {
        "holdings": enriched,
        "total_invested": round(total_invested, 2),
        "total_current": round(total_current, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": total_pnl_pct,
    }


def _get_price_map() -> dict:
    """모든 종목의 현재가 맵 생성"""
    price_map = {}
    try:
        kr_data = get_kr_stock_data()
        for s in kr_data:
            price_map[f"KR:{s['symbol']}"] = s["price"]
    except Exception:
        pass
    try:
        us_data = get_us_stock_data()
        for s in us_data:
            price_map[f"US:{s['symbol']}"] = s["price"]
    except Exception:
        pass
    return price_map
