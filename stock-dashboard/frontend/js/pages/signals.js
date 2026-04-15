/**
 * 신호등 페이지
 */
let signalsData = [];

async function loadSignals() {
    const container = document.getElementById('view-signals');
    container.innerHTML = '<div class="loading">신호등 분석 중... (최대 30초 소요)</div>';

    try {
        const res = await api('/api/signals/summary?market=all');
        signalsData = res.signals || [];

        // 대시보드에도 신호 반영
        signalsData.forEach(s => {
            dashboardSignals[`${s.market}:${s.symbol}`] = s;
        });

        renderSignals();
    } catch (err) {
        container.innerHTML = '<div class="loading">신호등 데이터를 불러올 수 없습니다.</div>';
    }
}

function renderSignals() {
    const container = document.getElementById('view-signals');

    const green = signalsData.filter(s => s.level === 'GREEN');
    const yellow = signalsData.filter(s => s.level === 'YELLOW');
    const red = signalsData.filter(s => s.level === 'RED');
    const capitulations = signalsData.filter(s => s.is_capitulation);

    container.innerHTML = `
        <!-- 요약 카드 -->
        <div class="signal-summary">
            <div class="summary-card green">
                <div class="summary-count">${green.length}</div>
                <div class="summary-label">순항</div>
            </div>
            <div class="summary-card yellow">
                <div class="summary-count">${yellow.length}</div>
                <div class="summary-label">관망</div>
            </div>
            <div class="summary-card red">
                <div class="summary-count">${red.length}</div>
                <div class="summary-label">위험</div>
            </div>
        </div>

        ${capitulations.length ? `
        <div class="section-title capitulation-title">극단적 공포 매수 기회</div>
        <div class="signal-list">
            ${capitulations.map(s => renderSignalRow(s)).join('')}
        </div>
        ` : ''}

        <div class="section-title">전체 종목 신호</div>
        <div class="signal-list">
            ${signalsData.sort((a, b) => a.score - b.score).map(s => renderSignalRow(s)).join('')}
        </div>
    `;
}

function renderSignalRow(s) {
    const capClass = s.is_capitulation ? ' capitulation-row' : '';
    return `
        <div class="signal-row${capClass}" onclick="openAnalysis('${s.market.toLowerCase()}', '${s.symbol}')">
            <div class="signal-row-left">
                ${createSignalDot(s.level, s.is_capitulation)}
                <div>
                    <div class="signal-row-name">${s.name}</div>
                    <div class="signal-row-symbol">${s.symbol} · ${s.market}</div>
                </div>
            </div>
            <div class="signal-row-right">
                ${createSignalBadge(s.level, s.score, s.is_capitulation)}
            </div>
        </div>
    `;
}
