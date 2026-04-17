# Stock Dashboard

This repo now has two runtimes:

- `backend/`: legacy FastAPI service for old routes such as auth, signals, portfolio, and analysis
- `apps/web/`: new 2026-oriented Next.js 16 + React 19 dashboard shell

The new app is not a cosmetic wrapper. It adds a provider abstraction, SSE quote streaming, a full-company search index, and a premium-feed migration path.

## New Stack

- Next.js 16.2.x App Router
- React 19.2.x
- Tailwind CSS 4
- TanStack Query 5
- Zustand persist
- `motion` for staged UI transitions
- `lightweight-charts` for market charts
- Optional Supabase hooks
- Optional Polygon paid US snapshot adapter
- Generated KR/US company universe for local search

## Run

1. Start the new dashboard.

```powershell
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000).

2. Start the legacy backend only if you still need old FastAPI routes.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python backend\app.py
```

3. Configure the new web app environment when needed.

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

## Provider Modes

- `MARKET_DATA_PROVIDER=yahoo-public`
  - Default for the new dashboard.
  - Uses Yahoo public chart endpoints directly for KR/US quotes and charts.
  - No FastAPI dependency for the dashboard path.
- `MARKET_DATA_PROVIDER=polygon`
  - Uses Polygon paid US snapshots when `POLYGON_API_KEY` exists.
  - Current implementation is low-latency polling, not direct websocket ticks.
  - KR quotes and charts fall back to the Yahoo public adapter.

## Commands

```powershell
npm run typecheck:web
npm run lint:web
npm run build:web
python -m compileall backend
```

## Notes

- The dashboard at `apps/web` no longer requires the FastAPI quote bridge.
- The legacy backend still remains because auth, signals, portfolio, AI analysis, and older routes are not yet migrated.
- `scripts/generate_stock_universe.py` regenerates the KR/US company search index using `finance-datareader`.
- Exact broker parity still requires broker or exchange websocket feeds. The new stack isolates that concern so we can swap providers without rewriting the UI again.
- Deployment notes for the legacy path remain in [DEPLOYMENT.md](/C:/Users/GS002/Documents/codex/stock-dashboard/DEPLOYMENT.md).
