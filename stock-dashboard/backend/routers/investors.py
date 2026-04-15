"""외국인/기관 매매 API 라우터 (한국 주식 전용)"""

from fastapi import APIRouter
from services.investor_flow import get_investor_trading, get_foreign_ownership

router = APIRouter(prefix="/api/investors", tags=["investors"])


@router.get("/{symbol}")
async def investor_trading(symbol: str, days: int = 20):
    data = get_investor_trading(symbol, days)
    return {"trading": data}


@router.get("/{symbol}/foreign-ownership")
async def foreign_ownership(symbol: str, days: int = 20):
    data = get_foreign_ownership(symbol, days)
    return {"ownership": data}
