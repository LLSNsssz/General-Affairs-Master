"""기술적 지표 계산 서비스"""

import pandas as pd
import numpy as np


def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """RSI (Relative Strength Index) 계산"""
    if df.empty or len(df) < period + 1:
        return pd.Series(dtype=float)
    delta = df["Close"].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    """MACD 계산"""
    if df.empty or len(df) < slow + signal:
        return {"macd_line": pd.Series(dtype=float), "signal_line": pd.Series(dtype=float), "histogram": pd.Series(dtype=float)}
    ema_fast = df["Close"].ewm(span=fast).mean()
    ema_slow = df["Close"].ewm(span=slow).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal).mean()
    histogram = macd_line - signal_line
    return {"macd_line": macd_line, "signal_line": signal_line, "histogram": histogram}


def calculate_bollinger(df: pd.DataFrame, period: int = 20, std_dev: float = 2.0) -> dict:
    """볼린저 밴드 계산"""
    if df.empty or len(df) < period:
        return {"upper": pd.Series(dtype=float), "middle": pd.Series(dtype=float), "lower": pd.Series(dtype=float)}
    middle = df["Close"].rolling(window=period).mean()
    std = df["Close"].rolling(window=period).std()
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    return {"upper": upper, "middle": middle, "lower": lower}


def calculate_moving_averages(df: pd.DataFrame, periods: list[int] = None) -> dict:
    """이동평균선 계산"""
    if periods is None:
        periods = [5, 20, 60, 120]
    if df.empty:
        return {}
    result = {}
    for p in periods:
        if len(df) >= p:
            result[f"ma{p}"] = df["Close"].rolling(window=p).mean()
        else:
            result[f"ma{p}"] = pd.Series(dtype=float)
    return result


def calculate_volume_ratio(df: pd.DataFrame, period: int = 20) -> float:
    """현재 거래량 / 20일 평균 거래량 비율"""
    if df.empty or len(df) < period + 1:
        return 1.0
    avg_volume = df["Volume"].iloc[-period - 1:-1].mean()
    current_volume = df["Volume"].iloc[-1]
    if avg_volume == 0:
        return 1.0
    return round(current_volume / avg_volume, 2)


def calculate_price_trend(df: pd.DataFrame, period: int = 20) -> str:
    """가격 추세 판별 (higher_lows / lower_highs / sideways)"""
    if df.empty or len(df) < period:
        return "sideways"
    recent = df.tail(period)
    half = len(recent) // 2
    first_half = recent.iloc[:half]
    second_half = recent.iloc[half:]

    first_low = first_half["Low"].min()
    second_low = second_half["Low"].min()
    first_high = first_half["High"].max()
    second_high = second_half["High"].max()

    if second_low > first_low and second_high >= first_high:
        return "higher_lows"
    elif second_high < first_high and second_low <= first_low:
        return "lower_highs"
    return "sideways"


def calculate_all(df: pd.DataFrame) -> dict:
    """모든 기술적 지표를 한번에 계산"""
    if df.empty:
        return {
            "rsi": None,
            "macd": None,
            "bollinger": None,
            "moving_averages": {},
            "volume_ratio": 1.0,
            "price_trend": "sideways",
            "current_price": 0,
        }

    rsi = calculate_rsi(df)
    macd = calculate_macd(df)
    bollinger = calculate_bollinger(df)
    mas = calculate_moving_averages(df)
    vol_ratio = calculate_volume_ratio(df)
    trend = calculate_price_trend(df)

    current_price = float(df["Close"].iloc[-1])
    current_rsi = float(rsi.iloc[-1]) if not rsi.empty and not pd.isna(rsi.iloc[-1]) else None

    # MACD 요약
    macd_summary = None
    if not macd["histogram"].empty:
        hist_val = float(macd["histogram"].iloc[-1])
        prev_hist = float(macd["histogram"].iloc[-2]) if len(macd["histogram"]) > 1 else 0
        macd_summary = {
            "histogram": round(hist_val, 4),
            "prev_histogram": round(prev_hist, 4),
            "bullish_crossover": hist_val > 0 and prev_hist <= 0,
            "bearish_crossover": hist_val < 0 and prev_hist >= 0,
            "decelerating": abs(hist_val) < abs(prev_hist),
        }

    # 볼린저 요약
    boll_summary = None
    if not bollinger["upper"].empty:
        boll_summary = {
            "upper": round(float(bollinger["upper"].iloc[-1]), 2),
            "middle": round(float(bollinger["middle"].iloc[-1]), 2),
            "lower": round(float(bollinger["lower"].iloc[-1]), 2),
            "position": _bollinger_position(current_price, bollinger),
        }

    # MA 정렬 상태
    ma_summary = {}
    for key, series in mas.items():
        if not series.empty and not pd.isna(series.iloc[-1]):
            ma_summary[key] = round(float(series.iloc[-1]), 2)

    ma_alignment = _check_ma_alignment(current_price, ma_summary)

    return {
        "rsi": round(current_rsi, 2) if current_rsi is not None else None,
        "macd": macd_summary,
        "bollinger": boll_summary,
        "moving_averages": ma_summary,
        "ma_alignment": ma_alignment,
        "volume_ratio": vol_ratio,
        "price_trend": trend,
        "current_price": round(current_price, 2),
    }


def _bollinger_position(price: float, bollinger: dict) -> str:
    """볼린저밴드 내 가격 위치"""
    upper = float(bollinger["upper"].iloc[-1])
    lower = float(bollinger["lower"].iloc[-1])
    if price >= upper:
        return "above_upper"
    elif price <= lower:
        return "below_lower"
    mid = (upper + lower) / 2
    if price > mid:
        return "upper_half"
    return "lower_half"


def _check_ma_alignment(price: float, ma_values: dict) -> str:
    """이동평균선 정렬 상태"""
    ma20 = ma_values.get("ma20")
    ma60 = ma_values.get("ma60")
    if ma20 is None or ma60 is None:
        return "unknown"
    if price > ma20 > ma60:
        return "bullish"  # 정배열
    elif price < ma20 < ma60:
        return "bearish"  # 역배열
    return "mixed"  # 혼조
