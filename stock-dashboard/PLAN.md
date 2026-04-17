# Stock Dashboard - 개발 계획서

## 프로젝트 개요
한국(KOSPI/KOSDAQ) + 미국(NYSE/NASDAQ) 종합 주식 분석 플랫폼
- 웹 + 모바일(PWA) 지원
- 멀티유저 배포 환경

---

## 현재 상태 (Phase 0 완료)

### 백엔드 (FastAPI) - 틀 완성
| 모듈 | 파일 | 상태 |
|------|------|------|
| 시세 조회 | `services/stock_data.py` | ✅ pykrx(KR), yfinance(US) 연동 |
| 기술적 지표 | `services/technical.py` | ✅ RSI, MACD, Bollinger, MA, 추세 |
| 재무제표 | `services/fundamental.py` | ✅ PER, PBR, ROE, EPS, 배당수익률 |
| 신호등 엔진 | `services/signal_engine.py` | ✅ 가중 스코어링 + 캐피츌레이션 |
| 뉴스 감성분석 | `services/news_scraper.py` | ✅ 네이버(KR), yfinance(US) |
| 투자자 동향 | `services/investor_flow.py` | ✅ 외국인/기관 매매 (KR) |
| 포트폴리오 | `services/portfolio_service.py` | ✅ CRUD, 평단가, 손익 |
| AI 분석 | `services/ai_analyzer.py` | ✅ Ollama → Gemini → 규칙기반 |
| 인증 | `auth.py` | ✅ JWT + SQLite/Supabase |
| DB | `database.py` | ✅ SQLite(개발) / Supabase(배포) |

### 프론트엔드 (Vanilla JS SPA) - 틀 완성
| 페이지 | 파일 | 상태 |
|--------|------|------|
| 대시보드 | `pages/dashboard.js` | ✅ 종목 카드 그리드, 시세 |
| 신호등 | `pages/signals.js` | ✅ GREEN/YELLOW/RED 요약 |
| 포트폴리오 | `pages/portfolio.js` | ✅ 보유종목, 손익 |
| 종목 분석 | `pages/analysis.js` | ✅ 차트, 지표, AI리포트 모달 |
| 로그인 | `login.html` | ✅ Google/Kakao/이메일 |

### 미구현 기능
- 관심종목(Watchlist) API — DB 테이블만 있고 엔드포인트 없음
- 신호 캐싱 — 테이블은 있지만 캐시 로직 미적용
- 사용자 설정 API — 테이블만 존재

---

## Phase 1: 핵심 기능 보강 & 버그 수정

### 1-1. 데이터 안정성
- [ ] yfinance US 데이터 0 반환 문제 대응 (재시도, 캐싱, 대체 소스)
- [ ] pykrx 장 마감 후 / 주말 데이터 처리 (최근 거래일 자동 탐색)
- [ ] API 응답 캐싱 적용 (signal_cache 테이블 활용, TTL 15분)
- [ ] 에러 핸들링 통일 (모든 라우터에 try-catch + 로깅)

### 1-2. 관심종목 (Watchlist)
- [ ] `POST /api/watchlist` — 종목 추가
- [ ] `GET /api/watchlist` — 목록 조회 (시세 포함)
- [ ] `DELETE /api/watchlist/{market}/{symbol}` — 삭제
- [ ] 프론트엔드 관심종목 페이지 또는 대시보드 통합

### 1-3. 사용자 설정
- [ ] `GET/PUT /api/settings` — 기본 마켓, 알림 설정 등
- [ ] 프론트엔드 설정 페이지 (하단 네비에 추가)

### 1-4. 신호등 성능 개선
- [ ] `/api/signals/summary` 캐싱 (현재 전종목 계산으로 느림)
- [ ] 백그라운드 태스크로 주기적 신호 갱신 (APScheduler)
- [ ] 프론트엔드 로딩 스켈레톤 UI

---

## Phase 2: UI/UX 완성

### 2-1. 차트 강화
- [ ] 캔들스틱 차트 (현재 라인 차트만)
- [ ] 이동평균선 오버레이
- [ ] MACD / RSI 서브차트
- [ ] 차트 기간 선택 (1M / 3M / 6M / 1Y)
- [ ] 줌/팬 인터랙션

### 2-2. 포트폴리오 개선
- [ ] 종목 추가 모달 (현재 prompt 기반 → 정식 폼)
- [ ] 매수/매도 이력 시각화 (타임라인 또는 테이블)
- [ ] 자산 비중 파이차트
- [ ] 수익률 그래프 (일별 추이)

### 2-3. 대시보드 개선
- [ ] 마켓 지수 표시 (KOSPI, KOSDAQ, S&P500, NASDAQ)
- [ ] 종목 정렬/필터 (등락률, 시가총액, 신호)
- [ ] 관심종목 우선 표시
- [ ] 풀-투-리프레시 (모바일)

### 2-4. 반응형 & 접근성
- [ ] 태블릿 레이아웃 최적화
- [ ] 다크/라이트 테마 전환
- [ ] 로딩 스켈레톤, 에러 상태 UI
- [ ] 토스트 알림 (매수/매도 완료 등)

---

## Phase 3: AI & 고급 분석

### 3-1. AI 분석 강화
- [ ] Ollama 모델 추천 및 설치 가이드 (RTX 4070 Ti 기준)
- [ ] Gemini API 키 설정 UI
- [ ] 분석 결과 캐싱 (같은 종목 반복 호출 방지)
- [ ] 분석 히스토리 저장 & 비교

### 3-2. 신호등 고도화
- [ ] 백테스팅: 과거 데이터로 신호 정확도 검증
- [ ] 가중치 커스터마이징 (사용자별 설정)
- [ ] 알림: 캐피츌레이션 감지시 푸시 알림 (PWA Notification)
- [ ] 신호 변경 이력 추적

### 3-3. 추가 분석 도구
- [ ] 섹터/업종 분석
- [ ] 상관관계 분석 (내 포트폴리오 종목 간)
- [ ] 배당 캘린더
- [ ] 52주 신고가/신저가 알림

---

## Phase 4: 배포 & 인프라

### 4-1. Supabase 설정
- [ ] Supabase 프로젝트 생성
- [ ] RLS(Row Level Security) 정책 설정
- [ ] Google OAuth 프로바이더 등록
- [ ] Kakao OAuth 프로바이더 등록
- [ ] DB 마이그레이션 스크립트

### 4-2. 백엔드 배포 (Railway 또는 Render)
- [ ] Dockerfile 검증 & 최적화
- [ ] 환경변수 설정
- [ ] 헬스체크 & 모니터링
- [ ] HTTPS 설정

### 4-3. 프론트엔드 배포 (Vercel)
- [ ] vercel.json API 프록시 설정 확인
- [ ] 환경변수 설정
- [ ] 커스텀 도메인 연결 (선택)

### 4-4. 운영
- [ ] 로깅 시스템 (구조화된 JSON 로그)
- [ ] 에러 모니터링 (Sentry 등)
- [ ] API rate limiting
- [ ] DB 백업 전략

---

## 우선순위 요약

```
[지금] Phase 1 → 데이터 안정성 + 캐싱 + 관심종목
 [다음] Phase 2 → UI/UX 완성 (차트, 포트폴리오, 대시보드)
  [그 다음] Phase 3 → AI 강화 + 백테스팅 + 알림
   [마지막] Phase 4 → Supabase + 배포 + 운영
```

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 백엔드 | Python 3.12, FastAPI, uvicorn |
| 데이터 | pykrx (한국), yfinance (미국) |
| DB | SQLite (개발) → Supabase PostgreSQL (배포) |
| 인증 | Supabase Auth (Google, Kakao, Email) |
| AI | Ollama (로컬 LLM) / Gemini (무료 API) |
| 프론트엔드 | Vanilla JS, Chart.js, PWA |
| 배포 | Vercel (프론트) + Railway/Render (백엔드) |
