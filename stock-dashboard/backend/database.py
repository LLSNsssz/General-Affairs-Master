"""Database helpers for SQLite development and Supabase deployment."""

import os
import sqlite3
from contextlib import contextmanager

from config import DATABASE_MODE, SQLITE_PATH, SUPABASE_KEY, SUPABASE_SERVICE_KEY, SUPABASE_URL

_supabase_client = None


def init_sqlite():
    """Initialize the local SQLite database."""
    os.makedirs(os.path.dirname(SQLITE_PATH), exist_ok=True)
    conn = sqlite3.connect(SQLITE_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.cursor()

    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT 'local',
            symbol TEXT NOT NULL,
            market TEXT NOT NULL CHECK(market IN ('KR', 'US')),
            name TEXT NOT NULL,
            quantity REAL NOT NULL,
            avg_price REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT '₩',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, symbol, market)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT 'local',
            symbol TEXT NOT NULL,
            market TEXT NOT NULL CHECK(market IN ('KR', 'US')),
            tx_type TEXT NOT NULL CHECK(tx_type IN ('BUY', 'SELL')),
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            currency TEXT NOT NULL,
            memo TEXT,
            tx_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT 'local',
            symbol TEXT NOT NULL,
            market TEXT NOT NULL CHECK(market IN ('KR', 'US')),
            name TEXT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, symbol, market)
        );

        CREATE TABLE IF NOT EXISTS signal_cache (
            symbol TEXT NOT NULL,
            market TEXT NOT NULL CHECK(market IN ('KR', 'US')),
            signal_level TEXT NOT NULL CHECK(signal_level IN ('GREEN', 'YELLOW', 'RED')),
            signal_score REAL NOT NULL,
            is_capitulation INTEGER NOT NULL DEFAULT 0,
            details_json TEXT,
            computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(symbol, market)
        );

        CREATE TABLE IF NOT EXISTS user_settings (
            user_id TEXT NOT NULL DEFAULT 'local',
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY(user_id, key)
        );
        """
    )

    conn.commit()
    conn.close()


@contextmanager
def get_sqlite_conn():
    """Yield a SQLite connection with automatic commit/rollback."""
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_supabase():
    """Return a singleton Supabase client."""
    global _supabase_client

    supabase_key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
    if not SUPABASE_URL or not supabase_key:
        raise RuntimeError("Supabase is not configured")

    if _supabase_client is None:
        from supabase import create_client

        _supabase_client = create_client(SUPABASE_URL, supabase_key)
    return _supabase_client


def init_db():
    """Initialize the configured backing store."""
    if DATABASE_MODE == "sqlite":
        init_sqlite()


def get_db():
    """Return the active database connection/client."""
    if DATABASE_MODE == "sqlite":
        return get_sqlite_conn()
    return get_supabase()


def check_db_health() -> dict:
    """Return a lightweight readiness snapshot for the current DB mode."""
    if DATABASE_MODE == "sqlite":
        try:
            with get_sqlite_conn() as conn:
                conn.execute("SELECT 1").fetchone()
            return {"mode": "sqlite", "ok": True}
        except Exception as exc:
            return {"mode": "sqlite", "ok": False, "error": repr(exc)}

    supabase_key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
    configured = bool(SUPABASE_URL and supabase_key)
    return {"mode": "supabase", "ok": configured, "configured": configured}
