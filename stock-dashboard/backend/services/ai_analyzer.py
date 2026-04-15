"""AI 분석 레이어

우선순위: Ollama (로컬) → Gemini (무료 API) → 규칙 기반 텍스트
"""

import json
import httpx
from config import OLLAMA_BASE_URL, GEMINI_API_KEY


async def generate_analysis(symbol: str, market: str, indicators: dict,
                            fundamentals: dict, signal: dict,
                            holding_info: dict | None = None) -> dict:
    """AI 분석 리포트 생성"""
    prompt = _build_prompt(symbol, market, indicators, fundamentals, signal, holding_info)

    # 1. Ollama 시도
    result = await _try_ollama(prompt)
    if result:
        return {"source": "ollama", "report": result}

    # 2. Gemini 시도
    result = await _try_gemini(prompt)
    if result:
        return {"source": "gemini", "report": result}

    # 3. 규칙 기반 폴백
    return {"source": "rule_based", "report": _rule_based_analysis(indicators, fundamentals, signal, holding_info)}


async def _try_ollama(prompt: str) -> str | None:
    """Ollama 로컬 LLM으로 분석"""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": "llama3",
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 500},
                },
            )
            if resp.status_code == 200:
                return resp.json().get("response", "")
    except Exception:
        return None


async def _try_gemini(prompt: str) -> str | None:
    """Google Gemini 무료 API로 분석"""
    if not GEMINI_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.3, "maxOutputTokens": 500},
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return None


def _build_prompt(symbol, market, indicators, fundamentals, signal, holding_info):
    parts = [
        f"당신은 주식 분석 전문가입니다. 다음 데이터를 바탕으로 한국어로 간결한 투자 의견을 제시하세요.",
        f"\n종목: {symbol} ({market})",
        f"신호등: {signal.get('signal_level', 'N/A')} (점수: {signal.get('signal_score', 'N/A')}/100)",
    ]

    if indicators.get("rsi"):
        parts.append(f"RSI: {indicators['rsi']}")
    if indicators.get("macd"):
        parts.append(f"MACD 히스토그램: {indicators['macd'].get('histogram', 'N/A')}")
    if indicators.get("ma_alignment"):
        parts.append(f"이평선 정렬: {indicators['ma_alignment']}")
    if indicators.get("volume_ratio"):
        parts.append(f"거래량 비율(20일 평균 대비): {indicators['volume_ratio']}x")

    if fundamentals.get("per"):
        parts.append(f"PER: {fundamentals['per']}, PBR: {fundamentals['pbr']}, ROE: {fundamentals.get('roe', 'N/A')}%")

    if holding_info:
        parts.append(f"\n내 평단가: {holding_info.get('avg_price', 'N/A')}, 보유수량: {holding_info.get('quantity', 'N/A')}")
        parts.append("현재가 대비 몇% 추가 하락하면 추가매수가 좋을지 제안해주세요.")

    if signal.get("is_capitulation"):
        parts.append("\n*** 극단적 공포 상태 감지됨 - 캐피츌레이션 가능성 분석 필요 ***")

    parts.append("\n다음 형식으로 답변:\n1. 현재 상태 요약 (1줄)\n2. 매수/매도/관망 의견\n3. 핵심 근거 (2-3줄)\n4. 추가매수 타이밍 제안 (해당시)")

    return "\n".join(parts)


def _rule_based_analysis(indicators, fundamentals, signal, holding_info) -> str:
    """규칙 기반 분석 텍스트 생성"""
    level = signal.get("signal_level", "YELLOW")
    score = signal.get("signal_score", 50)
    rsi = indicators.get("rsi")
    ma = indicators.get("ma_alignment", "unknown")

    lines = []

    # 상태 요약
    if level == "GREEN":
        lines.append("현재 상태: 기술적 지표가 전반적으로 양호합니다.")
    elif level == "YELLOW":
        lines.append("현재 상태: 혼조세로 방향성이 불분명합니다.")
    else:
        lines.append("현재 상태: 기술적 지표가 약세를 나타내고 있습니다.")

    # 의견
    if signal.get("is_capitulation"):
        lines.append("의견: 극단적 공포 구간 - 분할 매수 기회 포착 가능")
    elif level == "GREEN" and score >= 80:
        lines.append("의견: 적극 매수 고려")
    elif level == "GREEN":
        lines.append("의견: 매수 긍정적")
    elif level == "YELLOW":
        lines.append("의견: 관망 권장")
    elif score >= 30:
        lines.append("의견: 매수 자제, 추가 하락 가능")
    else:
        lines.append("의견: 매도 또는 손절 검토")

    # 근거
    reasons = []
    if rsi:
        if rsi > 70:
            reasons.append(f"RSI {rsi}로 과매수 구간")
        elif rsi < 30:
            reasons.append(f"RSI {rsi}로 과매도 구간")
        else:
            reasons.append(f"RSI {rsi}")

    if ma == "bullish":
        reasons.append("이평선 정배열(상승 추세)")
    elif ma == "bearish":
        reasons.append("이평선 역배열(하락 추세)")

    if fundamentals.get("per") and fundamentals["per"] > 0:
        per = fundamentals["per"]
        if per < 10:
            reasons.append(f"PER {per}으로 저평가")
        elif per > 30:
            reasons.append(f"PER {per}으로 고평가")

    lines.append("근거: " + ", ".join(reasons) if reasons else "근거: 추가 데이터 필요")

    # 추가매수 제안
    if holding_info and holding_info.get("avg_price"):
        avg = holding_info["avg_price"]
        if level in ("RED", "YELLOW"):
            suggested_drop = 10 if level == "YELLOW" else 20
            target = round(avg * (1 - suggested_drop / 100), 2)
            lines.append(f"추가매수 제안: 평단가({avg}) 대비 {suggested_drop}% 하락 시({target}) 분할 매수 고려")

    return "\n".join(lines)
