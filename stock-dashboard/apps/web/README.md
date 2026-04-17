# Stock Command Center

Modern frontend shell for the stock dashboard rewrite.

## Runtime

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- TanStack Query 5
- Zustand persist
- SSE quote streaming

## Local Run

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

This app expects the legacy backend to be running at `LEGACY_API_BASE_URL`.
That is no longer true for the dashboard quote and chart path. The legacy backend is optional unless you still need older FastAPI features elsewhere in the repo.

## Current Provider Flow

- `yahoo-public`: direct KR/US quote and chart adapter
- `polygon`: paid US snapshot adapter with yahoo-public fallback for the rest

## Search Index

`scripts/generate_stock_universe.py` regenerates the search universe JSON from `finance-datareader`.

## Quality Gates

```powershell
npm run typecheck
npm run lint
npm run build
```
