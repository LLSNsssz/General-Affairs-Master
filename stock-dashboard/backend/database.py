import sqlite3
import os
from contextlib import contextmanager
from config import DATABASE_MODE, SQLITE_PATH, SUPABASE_URL, SUPABASE_KEY

# --- SQLite (로컬 개발) ---

def init_sqlite():
    """SQLite DB 초기화 - 테이블 생성"""
    os.makedirs(os.path.dirname(SQLITE_PATH), exist_ok=True)
    conn = sqlite3.connect(SQLITE_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.cursor()

    cursor.executescript("""
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
    """)

    conn.commit()
    conn.close()


@contextmanager
def get_sqlite_conn():
    """SQLite 연결 컨텍스트 매니저"""
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


# --- Supabase (배포용) ---

_supabase_client = None

def get_supabase():
    """Supabase 클라이언트 싱글톤"""
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase_client


# --- 통합 인터페이스 ---

def init_db():
    """앱 시작시 DB 초기화"""
    if DATABASE_MODE == "sqlite":
        init_sqlite()
        print(f"[DB] SQLite initialized at {SQLITE_PATH}")
    else:
        print(f"[DB] Supabase mode - {SUPABASE_URL}")


def get_db():
    """현재 DB 모드에 맞는 연결 반환"""
    if DATABASE_MODE == "sqlite":
        return get_sqlite_conn()
    else:
        return get_supabase()
