"""Portfolio API routes."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

from auth import require_auth
from services.portfolio_service import (
    delete_holding,
    get_portfolio_summary,
    get_transactions,
    sell_holding,
    upsert_holding,
)

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class HoldingRequest(BaseModel):
    symbol: str
    market: str
    name: str
    quantity: float
    avg_price: float
    currency: str = "₩"


class SellRequest(BaseModel):
    symbol: str
    market: str
    quantity: float
    price: float
    currency: str = "₩"


@router.get("")
async def portfolio(request: Request, fresh: bool = False):
    user_id = await require_auth(request)
    return get_portfolio_summary(user_id, force_refresh=fresh)


@router.post("/holdings")
async def add_holding(body: HoldingRequest, request: Request):
    user_id = await require_auth(request)
    return upsert_holding(
        user_id,
        body.symbol,
        body.market,
        body.name,
        body.quantity,
        body.avg_price,
        body.currency,
    )


@router.post("/sell")
async def sell(body: SellRequest, request: Request):
    user_id = await require_auth(request)
    return sell_holding(
        user_id,
        body.symbol,
        body.market,
        body.quantity,
        body.price,
        body.currency,
    )


@router.delete("/holdings/{market}/{symbol}")
async def remove_holding(market: str, symbol: str, request: Request):
    user_id = await require_auth(request)
    return delete_holding(user_id, symbol, market.upper())


@router.get("/transactions")
async def transactions(request: Request, limit: int = 50):
    user_id = await require_auth(request)
    return {"transactions": get_transactions(user_id, limit)}
