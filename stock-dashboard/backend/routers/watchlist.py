"""Watchlist API routes."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

from auth import require_auth
from services.watchlist_service import add_watchlist_item, delete_watchlist_item, get_watchlist

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistRequest(BaseModel):
    symbol: str
    market: str
    name: str


@router.get("")
async def list_watchlist(request: Request, fresh: bool = False):
    user_id = await require_auth(request)
    return {"watchlist": get_watchlist(user_id, force_refresh=fresh)}


@router.post("")
async def create_watchlist_item(body: WatchlistRequest, request: Request):
    user_id = await require_auth(request)
    return add_watchlist_item(user_id, body.symbol, body.market, body.name)


@router.delete("/{market}/{symbol}")
async def remove_watchlist_item(market: str, symbol: str, request: Request):
    user_id = await require_auth(request)
    return delete_watchlist_item(user_id, symbol, market)
