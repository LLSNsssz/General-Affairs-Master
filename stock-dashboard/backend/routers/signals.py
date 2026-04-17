"""Signal API routes."""

from fastapi import APIRouter

from config import DEFAULT_KR_STOCKS, DEFAULT_US_STOCKS
from services.signal_service import get_signal

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.get("/summary")
async def signals_summary(market: str = "all"):
    """Return summary signals for the default KR and US watchlists."""
    market = market.lower()
    results = []

    if market in ("all", "kr"):
        results.extend(_collect_signal_summaries(DEFAULT_KR_STOCKS, "KR"))

    if market in ("all", "us"):
        results.extend(_collect_signal_summaries(DEFAULT_US_STOCKS, "US"))

    return {"signals": results}


@router.get("/{market}/{symbol}")
async def single_signal(market: str, symbol: str):
    """Return a detailed signal for one stock."""
    return get_signal(symbol, market.upper())


def _collect_signal_summaries(stocks: dict[str, str], market: str) -> list[dict]:
    results = []
    for symbol, name in stocks.items():
        try:
            signal = get_signal(symbol, market)
            results.append(
                {
                    "symbol": symbol,
                    "name": name,
                    "market": market,
                    **_signal_summary(signal),
                }
            )
        except Exception:
            results.append(_fallback_signal(symbol, name, market))
    return results


def _signal_summary(signal: dict) -> dict:
    return {
        "level": signal["signal_level"],
        "score": signal["signal_score"],
        "is_capitulation": signal["is_capitulation"],
    }


def _fallback_signal(symbol: str, name: str, market: str) -> dict:
    return {
        "symbol": symbol,
        "name": name,
        "market": market,
        "level": "YELLOW",
        "score": 50,
        "is_capitulation": False,
    }
