/**
 * 종목 상세 분석 페이지
 */
let analysisCharts = [];

async function openAnalysis(market, symbol) {
    const modal = document.getElementById('analysisModal');
    const body = document.getElementById('analysisBody');
    const title = document.getElementById('analysisTitle');

    modal.classList.remove('hidden');
    body.innerHTML = '<div class="loading">종합 분석 중...</div>';
    title.textContent = `${symbol} 분석`;

    // 기존 차트 정리
    analysisCharts.forEach(c => c.destroy());
    analysisCharts = [];

    try {
        const [analysisRes, chartRes, newsRes] = await Promise.all([
            api(`/api/analysis/${market}/${symbol}`),
            api(`/api/chart/${market}/${symbol}?days=90`),
            api(`/api/news/${market}/${symbol}?limit=5`),
        ]);

        title.textContent = `${analysisRes.symbol} 종합 분석`;

        // 신호등 배지
        const sig = analysisRes.signal;
        document.getElementById('analysisSignalBadge').innerHTML =
            createSignalBadge(sig.level, sig.score, sig.is_capitulation);

        body.innerHTML = buildAnalysisHTML(analysisRes, chartRes, newsRes);

        // 차트 렌더링
        renderAnalysisCharts(chartRes, analysisRes.indicators);

    } catch (err) {
        body.innerHTML = `<div class="loading">분석 실패: ${err.message}</div>`;
    }
}

function closeAnalysis() {
    document.getElementById('analysisModal').classList.add('hidden');
    analysisCharts.forEach(c => c.destroy());
    analysisCharts = [];
}

function buildAnalysisHTML(analysis, chartData, newsData) {
    const ind = analysis.indicators || {};
    const fund = analysis.fundamentals || {};
    const ai = analysis.ai_report || {};
    const news = newsData.news || [];

    return `
        <!-- AI 리포트 -->
        <div class="analysis-section">
            <h3>AI 분석 리포트 <span class="ai-source">${ai.source || 'rule_based'}</span></h3>
            <div class="ai-report">${(ai.report || '분석 데이터 없음').replace(/\n/g, '<br>')}</div>
        </div>

        <!-- 가격 차트 -->
        <div class="analysis-section">
            <h3>가격 차트 (3개월)</h3>
            <div class="chart-container"><canvas id="analysisPriceChart"></canvas></div>
            <div class="chart-container volume-chart"><canvas id="analysisVolumeChart"></canvas></div>
        </div>

        <!-- 기술적 지표 -->
        <div class="analysis-section">
            <h3>기술적 지표</h3>
            <div class="indicator-grid">
                <div class="indicator-item">
                    <div class="ind-label">RSI (14)</div>
                    <div class="ind-value ${rsiClass(ind.rsi)}">${ind.rsi ?? 'N/A'}</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">MACD</div>
                    <div class="ind-value">${ind.macd?.histogram ?? 'N/A'}</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">이평선</div>
                    <div class="ind-value">${maLabel(ind.ma_alignment)}</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">거래량 비율</div>
                    <div class="ind-value">${ind.volume_ratio ?? 'N/A'}x</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">추세</div>
                    <div class="ind-value">${trendLabel(ind.price_trend)}</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">볼린저</div>
                    <div class="ind-value">${bollLabel(ind.bollinger?.position)}</div>
                </div>
            </div>
        </div>

        <!-- 재무 지표 -->
        <div class="analysis-section">
            <h3>재무 지표</h3>
            <div class="indicator-grid">
                <div class="indicator-item">
                    <div class="ind-label">PER</div>
                    <div class="ind-value">${fund.per || 'N/A'}</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">PBR</div>
                    <div class="ind-value">${fund.pbr || 'N/A'}</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">ROE</div>
                    <div class="ind-value">${fund.roe ? fund.roe + '%' : 'N/A'}</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">EPS</div>
                    <div class="ind-value">${fund.eps || 'N/A'}</div>
                </div>
                <div class="indicator-item">
                    <div class="ind-label">배당수익률</div>
                    <div class="ind-value">${fund.div_yield ? fund.div_yield + '%' : 'N/A'}</div>
                </div>
            </div>
        </div>

        <!-- 신호등 상세 -->
        <div class="analysis-section">
            <h3>신호등 상세</h3>
            <div class="signal-breakdown">
                ${Object.entries(analysis.signal.breakdown || {}).map(([key, val]) => `
                    <div class="breakdown-row">
                        <span class="breakdown-label">${signalKeyLabel(key)}</span>
                        <div class="breakdown-bar-bg">
                            <div class="breakdown-bar" style="width:${val.score}%;background:${barColor(val.score)}"></div>
                        </div>
                        <span class="breakdown-score">${val.score}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- 뉴스 -->
        ${news.length ? `
        <div class="analysis-section">
            <h3>최근 뉴스</h3>
            <div class="news-list">
                ${news.map(n => `
                    <div class="news-item">
                        <span class="news-sentiment" style="color:${n.sentiment > 0 ? '#22c55e' : n.sentiment < 0 ? '#ef4444' : '#64748b'}">
                            ${n.sentiment > 0 ? '+' : ''}${n.sentiment}
                        </span>
                        <span class="news-title">${n.title}</span>
                        <span class="news-date">${n.date || ''}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    `;
}

function renderAnalysisCharts(chartData, indicators) {
    const data = chartData.chart || [];
    if (!data.length) return;

    const labels = data.map(d => d.date);
    const prices = data.map(d => d.close);
    const volumes = data.map(d => d.volume);

    // 볼린저 밴드 오버레이
    const extraDatasets = [];
    if (indicators.bollinger) {
        // 간단히 마지막 값으로 수평선 표시 (실제로는 전체 시리즈가 필요하지만 간략화)
    }

    const priceCtx = document.getElementById('analysisPriceChart')?.getContext('2d');
    if (priceCtx) {
        analysisCharts.push(createPriceChart(priceCtx, labels, prices, extraDatasets));
    }

    const volCtx = document.getElementById('analysisVolumeChart')?.getContext('2d');
    if (volCtx) {
        analysisCharts.push(createVolumeChart(volCtx, labels, volumes, prices));
    }
}

// 유틸 함수
function rsiClass(rsi) {
    if (rsi == null) return '';
    return rsi > 70 ? 'up' : rsi < 30 ? 'down' : '';
}

function maLabel(alignment) {
    return { bullish: '정배열', bearish: '역배열', mixed: '혼조', unknown: '-' }[alignment] || '-';
}

function trendLabel(trend) {
    return { higher_lows: '상승', lower_highs: '하락', sideways: '횡보' }[trend] || '-';
}

function bollLabel(pos) {
    return { above_upper: '상단 이탈', upper_half: '상단', lower_half: '하단', below_lower: '하단 이탈' }[pos] || '-';
}

function signalKeyLabel(key) {
    const labels = {
        rsi: 'RSI', macd: 'MACD', bollinger: '볼린저', ma_alignment: '이평선',
        volume_ratio: '거래량', news_sentiment: '뉴스', investor_flow: '외인/기관', price_trend: '추세',
    };
    return labels[key] || key;
}

function barColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#eab308';
    return '#ef4444';
}
