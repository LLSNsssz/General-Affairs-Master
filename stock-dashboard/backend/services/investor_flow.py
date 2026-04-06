"""외국인/기관 투자자 매매 데이터 (한국 주식 전용)"""

from datetime import datetime, timedelta
from pykrx import stock as krx_stock


def get_investor_trading(symbol: str, days: int = 20) -> list[dict]:
    """외국인/기관/개인 순매매 데이터"""
    end = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
    try:
        df = krx_stock.get_market_trading_value_by_date(start, end, symbol)
        if df.empty:
            return []
        result = []
        for date, row in df.iterrows():
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "foreign": int(row.get("외국인합계", 0)),
                "institution": int(row.get("기관합계", 0)),
                "individual": int(row.get("개인", 0)),
            })
        return result
    except Exception:
        return []


def get_foreign_ownership(symbol: str, days: int = 20) -> list[dict]:
    """외국인 보유 비율 추이"""
    end = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
    try:
        df = krx_stock.get_exhaustion_rates_of_foreign_investment_by_date(start, end, symbol)
        if df.empty:
            return []
        result = []
        for date, row in df.iterrows():
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "ownership_ratio": round(float(row.get("지분율", 0)), 2),
                "holding_shares": int(row.get("보유수량", 0)),
            })
        return result
    except Exception:
        return []


def get_investor_flow_score(symbol: str, days: int = 5) -> float:
    """외국인/기관 매매 흐름 점수 (-1.0 ~ 1.0)

    최근 N일간 외국인+기관 순매수가 양수이면 +, 음수이면 -
    """
    data = get_investor_trading(symbol, days=days + 10)
    if not data:
        return 0.0

    recent = data[-days:] if len(data) >= days else data
    net_buy = sum(d["foreign"] + d["institution"] for d in recent)

    if net_buy == 0:
        return 0.0

    # 정규화 (대략적으로 10억 이상이면 ±1.0)
    normalized = net_buy / 1_000_000_000
    return round(max(-1.0, min(1.0, normalized)), 2)
