"""공포/탐욕 신호등 엔진

점수: 0~100
- 70~100 = GREEN (순항, 적극 매수)
- 40~69  = YELLOW (관망 권장)
- 0~39   = RED (위험)

캐피츌레이션: RED 상태에서 극단적 공포 매수 기회 감지
"""

from services.technical import calculate_all
from services.stock_data import get_ohlcv_dataframe
from config import SIGNAL_WEIGHTS, SIGNAL_THRESHOLDS, CAPITULATION_CONDITIONS


def compute_signal(symbol: str, market: str, news_score: float = 0.0, investor_score: float = 0.0) -> dict:
    """종목 신호등 계산

    Args:
        symbol: 종목 코드
        market: "KR" or "US"
        news_score: 뉴스 감성 점수 (-1.0 ~ 1.0)
        investor_score: 외인/기관 흐름 점수 (-1.0 ~ 1.0, KR only)

    Returns:
        {signal_level, signal_score, is_capitulation, breakdown}
    """
    df = get_ohlcv_dataframe(symbol, market, days=120)
    if df.empty or len(df) < 20:
        return _default_signal()

    indicators = calculate_all(df)
    breakdown = {}

    # 1. RSI 점수 (20%)
    rsi_score = _score_rsi(indicators.get("rsi"))
    breakdown["rsi"] = {"value": indicators.get("rsi"), "score": rsi_score}

    # 2. MACD 점수 (15%)
    macd_score = _score_macd(indicators.get("macd"))
    breakdown["macd"] = {"value": indicators.get("macd", {}).get("histogram") if indicators.get("macd") else None, "score": macd_score}

    # 3. 볼린저밴드 점수 (10%)
    boll_score = _score_bollinger(indicators.get("bollinger"))
    breakdown["bollinger"] = {"value": indicators.get("bollinger", {}).get("position") if indicators.get("bollinger") else None, "score": boll_score}

    # 4. MA 정렬 점수 (15%)
    ma_score = _score_ma_alignment(indicators.get("ma_alignment"))
    breakdown["ma_alignment"] = {"value": indicators.get("ma_alignment"), "score": ma_score}

    # 5. 거래량 비율 점수 (10%)
    vol_score = _score_volume(indicators.get("volume_ratio", 1.0), indicators.get("price_trend"))
    breakdown["volume_ratio"] = {"value": indicators.get("volume_ratio"), "score": vol_score}

    # 6. 뉴스 감성 점수 (10%)
    news_score_val = _score_sentiment(news_score)
    breakdown["news_sentiment"] = {"value": news_score, "score": news_score_val}

    # 7. 외인/기관 흐름 점수 (10%, KR only)
    inv_score_val = _score_sentiment(investor_score)
    breakdown["investor_flow"] = {"value": investor_score, "score": inv_score_val}

    # 8. 가격 추세 점수 (10%)
    trend_score = _score_price_trend(indicators.get("price_trend"))
    breakdown["price_trend"] = {"value": indicators.get("price_trend"), "score": trend_score}

    # 가중합 계산
    weights = SIGNAL_WEIGHTS.copy()
    if market == "US":
        # 미국은 외인 데이터 없으므로 가중치 재배분
        extra = weights.pop("investor_flow", 0.10)
        weights["rsi"] += extra / 2
        weights["ma_alignment"] += extra / 2

    total_score = (
        rsi_score * weights.get("rsi", 0.20)
        + macd_score * weights.get("macd", 0.15)
        + boll_score * weights.get("bollinger", 0.10)
        + ma_score * weights.get("ma_alignment", 0.15)
        + vol_score * weights.get("volume_ratio", 0.10)
        + news_score_val * weights.get("news_sentiment", 0.10)
        + inv_score_val * weights.get("investor_flow", 0.0)
        + trend_score * weights.get("price_trend", 0.10)
    )
    total_score = round(total_score, 1)

    # 신호등 결정
    if total_score >= SIGNAL_THRESHOLDS["green_min"]:
        level = "GREEN"
    elif total_score >= SIGNAL_THRESHOLDS["yellow_min"]:
        level = "YELLOW"
    else:
        level = "RED"

    # 캐피츌레이션 감지
    is_capitulation = _check_capitulation(indicators, level)

    return {
        "signal_level": level,
        "signal_score": total_score,
        "is_capitulation": is_capitulation,
        "breakdown": breakdown,
        "indicators": indicators,
    }


def _score_rsi(rsi: float | None) -> float:
    """RSI → 0~100 점수. 과매도 반등 구간이 가장 높은 점수."""
    if rsi is None:
        return 50
    if 30 <= rsi <= 50:
        return 85  # 과매도 반등 구간
    elif 50 < rsi <= 60:
        return 70  # 약간 강세
    elif 60 < rsi <= 70:
        return 50  # 보통
    elif rsi > 70:
        return 20  # 과매수
    elif 20 <= rsi < 30:
        return 40  # 낙폭 과대 (아직 반등 신호 없음)
    else:  # rsi < 20
        return 25  # 극단적 과매도 (패닉)


def _score_macd(macd: dict | None) -> float:
    if macd is None:
        return 50
    hist = macd.get("histogram", 0)
    if macd.get("bullish_crossover"):
        return 90
    elif hist > 0:
        return 70
    elif macd.get("bearish_crossover"):
        return 15
    elif hist < 0 and macd.get("decelerating"):
        return 45  # 하락세 둔화
    elif hist < 0:
        return 25
    return 50


def _score_bollinger(boll: dict | None) -> float:
    if boll is None:
        return 50
    pos = boll.get("position")
    if pos == "below_lower":
        return 30  # 하단 이탈 (위험하지만 반등 가능)
    elif pos == "lower_half":
        return 65
    elif pos == "upper_half":
        return 55
    elif pos == "above_upper":
        return 25  # 과매수 영역
    return 50


def _score_ma_alignment(alignment: str | None) -> float:
    if alignment == "bullish":
        return 90
    elif alignment == "bearish":
        return 15
    elif alignment == "mixed":
        return 50
    return 50


def _score_volume(vol_ratio: float, trend: str | None) -> float:
    """거래량 + 가격 방향 복합 점수"""
    if vol_ratio > 1.5 and trend == "higher_lows":
        return 85  # 상승 + 대량 거래 = 강세
    elif vol_ratio > 1.5 and trend == "lower_highs":
        return 20  # 하락 + 대량 거래 = 투매
    elif 0.8 <= vol_ratio <= 1.2:
        return 55  # 보통
    elif vol_ratio < 0.8:
        return 45  # 거래 부진
    return 50


def _score_sentiment(score: float) -> float:
    """감성 점수 (-1.0~1.0) → 0~100"""
    return round(50 + score * 50, 1)


def _score_price_trend(trend: str | None) -> float:
    if trend == "higher_lows":
        return 80
    elif trend == "lower_highs":
        return 20
    return 50


def _check_capitulation(indicators: dict, level: str) -> bool:
    """캐피츌레이션(극단적 공포 매수 기회) 감지"""
    if level != "RED":
        return False

    rsi = indicators.get("rsi")
    if rsi is None or rsi >= CAPITULATION_CONDITIONS["rsi_max"]:
        return False

    vol_ratio = indicators.get("volume_ratio", 1.0)
    if vol_ratio < CAPITULATION_CONDITIONS["volume_ratio_min"]:
        return False

    boll = indicators.get("bollinger")
    if boll is None or boll.get("position") != "below_lower":
        return False

    macd = indicators.get("macd")
    if macd is None or not macd.get("decelerating"):
        return False

    return True


def _default_signal() -> dict:
    return {
        "signal_level": "YELLOW",
        "signal_score": 50,
        "is_capitulation": False,
        "breakdown": {},
        "indicators": {},
    }
