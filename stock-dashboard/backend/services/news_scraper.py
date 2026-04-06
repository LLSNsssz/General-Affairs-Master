"""뉴스 스크래핑 + 키워드 감성 분석"""

import requests
from bs4 import BeautifulSoup
import yfinance as yf

# 한국어 감성 키워드
POSITIVE_KR = [
    "상승", "급등", "호재", "신고가", "성장", "실적개선", "매수",
    "긍정", "기대", "호실적", "돌파", "반등", "회복", "흑자",
    "상향", "강세", "수주", "투자", "확대", "이익",
]
NEGATIVE_KR = [
    "하락", "급락", "악재", "신저가", "하향", "적자", "매도",
    "우려", "위기", "부진", "폭락", "손실", "감소", "약세",
    "리스크", "위험", "파산", "소송", "제재", "축소",
]

# 영어 감성 키워드
POSITIVE_EN = [
    "surge", "rally", "bullish", "growth", "upgrade", "beat",
    "gain", "profit", "buy", "positive", "record", "strong",
    "outperform", "recover", "expansion",
]
NEGATIVE_EN = [
    "crash", "plunge", "bearish", "decline", "downgrade", "miss",
    "loss", "sell", "negative", "risk", "warning", "weak",
    "underperform", "recession", "layoff",
]


def get_news(symbol: str, market: str, limit: int = 10) -> list[dict]:
    """종목 뉴스 조회"""
    if market == "KR":
        return _get_kr_news(symbol, limit)
    return _get_us_news(symbol, limit)


def _get_kr_news(symbol: str, limit: int) -> list[dict]:
    """네이버 금융 뉴스 스크래핑"""
    url = f"https://finance.naver.com/item/news_news.naver?code={symbol}&page=1"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        resp.encoding = "euc-kr"
        soup = BeautifulSoup(resp.text, "html.parser")
        rows = soup.select("table.type5 tbody tr")

        news_list = []
        for row in rows[:limit]:
            title_tag = row.select_one("td.title a")
            date_tag = row.select_one("td.date")
            if not title_tag:
                continue
            title = title_tag.text.strip()
            date = date_tag.text.strip() if date_tag else ""
            sentiment = _score_headline(title, "kr")
            news_list.append({
                "title": title,
                "date": date,
                "sentiment": sentiment,
                "source": "네이버금융",
            })
        return news_list
    except Exception:
        return []


def _get_us_news(symbol: str, limit: int) -> list[dict]:
    """yfinance 뉴스"""
    try:
        ticker = yf.Ticker(symbol)
        news = ticker.news or []
        result = []
        for item in news[:limit]:
            title = item.get("title", "")
            sentiment = _score_headline(title, "en")
            result.append({
                "title": title,
                "date": "",
                "sentiment": sentiment,
                "source": item.get("publisher", ""),
                "url": item.get("link", ""),
            })
        return result
    except Exception:
        return []


def _score_headline(title: str, lang: str) -> float:
    """헤드라인 감성 점수 (-1.0 ~ 1.0)"""
    title_lower = title.lower()
    pos_keywords = POSITIVE_KR if lang == "kr" else POSITIVE_EN
    neg_keywords = NEGATIVE_KR if lang == "kr" else NEGATIVE_EN

    pos_count = sum(1 for kw in pos_keywords if kw in title_lower)
    neg_count = sum(1 for kw in neg_keywords if kw in title_lower)

    total = pos_count + neg_count
    if total == 0:
        return 0.0
    return round((pos_count - neg_count) / total, 2)


def get_news_sentiment(symbol: str, market: str, limit: int = 10) -> float:
    """종목 뉴스 전체 감성 평균 (-1.0 ~ 1.0)"""
    news = get_news(symbol, market, limit)
    if not news:
        return 0.0
    scores = [n["sentiment"] for n in news]
    return round(sum(scores) / len(scores), 2)
