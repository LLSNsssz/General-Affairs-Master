import os
from dotenv import load_dotenv

load_dotenv()

# --- Environment ---
ENV = os.getenv("ENV", "development")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# --- CORS ---
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000").split(",")

# --- Database ---
DATABASE_MODE = os.getenv("DATABASE_MODE", "sqlite")  # "sqlite" or "supabase"
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "stock.db")

# --- Supabase ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# --- AI ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# --- Signal Engine Thresholds ---
SIGNAL_CACHE_TTL_MINUTES = 15

SIGNAL_WEIGHTS = {
    "rsi": 0.20,
    "macd": 0.15,
    "bollinger": 0.10,
    "ma_alignment": 0.15,
    "volume_ratio": 0.10,
    "news_sentiment": 0.10,
    "investor_flow": 0.10,  # KR only; redistributed for US
    "price_trend": 0.10,
}

SIGNAL_THRESHOLDS = {
    "green_min": 70,
    "yellow_min": 40,
    # below yellow_min = RED
}

CAPITULATION_CONDITIONS = {
    "rsi_max": 25,
    "volume_ratio_min": 2.5,
    "below_bollinger_lower": True,
    "macd_decelerating": True,
}

# --- Default Stock Lists ---
DEFAULT_KR_STOCKS = {
    "005930": "삼성전자",
    "000660": "SK하이닉스",
    "035420": "NAVER",
    "035720": "카카오",
    "051910": "LG화학",
    "006400": "삼성SDI",
    "068270": "셀트리온",
    "105560": "KB금융",
    "055550": "신한지주",
    "003670": "포스코퓨처엠",
}

DEFAULT_US_STOCKS = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Alphabet",
    "AMZN": "Amazon",
    "NVDA": "NVIDIA",
    "TSLA": "Tesla",
    "META": "Meta",
    "JPM": "JPMorgan",
    "V": "Visa",
    "TSM": "TSMC",
}
