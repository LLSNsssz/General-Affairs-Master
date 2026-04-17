# Deployment Guide

## 1. Supabase

1. Create a Supabase project.
2. Open the SQL editor and run [schema.sql](/C:/Users/GS002/Documents/codex/stock-dashboard/supabase/schema.sql).
3. Copy these values into backend env vars:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `SUPABASE_SERVICE_KEY`
4. Set `DATABASE_MODE=supabase` on the backend deployment.

OAuth providers still require manual dashboard setup:

- Google redirect URL: `https://<your-frontend-domain>/login`
- Kakao redirect URL: `https://<your-frontend-domain>/login`
- Local test redirect URL: `http://localhost:8000/login`

## 2. Backend (Railway/Render)

Use [backend/Dockerfile](/C:/Users/GS002/Documents/codex/stock-dashboard/backend/Dockerfile) from the repo root as the container entrypoint.

Recommended env vars:

- `ENV=production`
- `DATABASE_MODE=supabase`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`
- `CORS_ORIGINS=https://<your-frontend-domain>`
- `LOG_JSON=true`
- `RATE_LIMIT_REQUESTS=120`
- `RATE_LIMIT_WINDOW_SECONDS=60`

Health endpoints:

- `/api/health`
- `/api/health/ready`

## 3. Frontend (Vercel)

Deploy the `frontend` directory to Vercel.

Set this Vercel environment variable:

- `BACKEND_API_BASE_URL=https://<your-backend-domain>/`

The frontend now uses [proxy.js](/C:/Users/GS002/Documents/codex/stock-dashboard/frontend/api/proxy.js) so client code can continue calling relative `/api/*` paths.

## 4. Operations

- Backend request logs support plaintext locally and JSON in production.
- A lightweight in-memory rate limiter is enabled for `/api/*`.
- The current limiter is per-process, so if you scale to multiple instances you will want Redis or a gateway-level limiter later.

## 5. Remaining Manual Work

- Register Google OAuth credentials in Supabase.
- Register Kakao OAuth credentials in Supabase.
- Point the final frontend domain to Vercel.
- Point the final backend domain to Railway or Render.
- If you need multi-instance API rate limiting, move the current in-memory limiter to Redis or your edge gateway.
