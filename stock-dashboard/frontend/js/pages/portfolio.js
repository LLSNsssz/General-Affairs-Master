/**
 * 포트폴리오 페이지
 */
let portfolioData = null;

async function loadPortfolio() {
    const container = document.getElementById('view-portfolio');

    if (!currentUser) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                </div>
                <h3>로그인이 필요합니다</h3>
                <p>포트폴리오를 관리하려면 로그인하세요.</p>
                <button class="primary-btn" onclick="showLogin()">로그인</button>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="loading">포트폴리오 로딩 중...</div>';

    try {
        const res = await api('/api/portfolio');
        portfolioData = res;
        renderPortfolio();
    } catch (err) {
        if (err.message.includes('401')) {
            container.innerHTML = '<div class="empty-state"><h3>로그인이 필요합니다</h3></div>';
        } else {
            container.innerHTML = '<div class="loading">포트폴리오를 불러올 수 없습니다.</div>';
        }
    }
}

function renderPortfolio() {
    const container = document.getElementById('view-portfolio');
    const d = portfolioData;

    if (!d || !d.holdings || !d.holdings.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>보유종목이 없습니다</h3>
                <p>종목을 추가해보세요.</p>
                <button class="primary-btn" onclick="showAddHoldingModal()">종목 추가</button>
            </div>
        `;
        return;
    }

    const pnlClass = d.total_pnl >= 0 ? 'up' : 'down';
    const pnlSign = d.total_pnl >= 0 ? '+' : '';

    container.innerHTML = `
        <div class="portfolio-summary">
            <div class="portfolio-card">
                <div class="portfolio-label">총 투자금</div>
                <div class="portfolio-value">${formatMoney(d.total_invested)}</div>
            </div>
            <div class="portfolio-card">
                <div class="portfolio-label">현재 평가</div>
                <div class="portfolio-value">${formatMoney(d.total_current)}</div>
            </div>
            <div class="portfolio-card highlight ${pnlClass}">
                <div class="portfolio-label">손익</div>
                <div class="portfolio-value">${pnlSign}${formatMoney(d.total_pnl)}</div>
                <div class="portfolio-sub">${pnlSign}${d.total_pnl_pct}%</div>
            </div>
        </div>

        <div class="section-title">보유 종목 <button class="add-btn" onclick="showAddHoldingModal()">+ 추가</button></div>
        <div class="holdings-list">
            ${d.holdings.map(h => renderHoldingRow(h)).join('')}
        </div>
    `;
}

function renderHoldingRow(h) {
    const pnlClass = h.pnl >= 0 ? 'up' : 'down';
    const pnlSign = h.pnl >= 0 ? '+' : '';

    return `
        <div class="holding-row" onclick="openAnalysis('${h.market.toLowerCase()}', '${h.symbol}')">
            <div class="holding-left">
                <div class="holding-name">${h.name}</div>
                <div class="holding-info">${h.symbol} · ${h.market} · ${h.quantity}주</div>
            </div>
            <div class="holding-right">
                <div class="holding-price">${h.currency}${h.current_price.toLocaleString()}</div>
                <div class="holding-pnl ${pnlClass}">${pnlSign}${h.pnl_pct}%</div>
                <div class="holding-avg">평단 ${h.currency}${h.avg_price.toLocaleString()}</div>
            </div>
        </div>
    `;
}

function showAddHoldingModal() {
    // 간단한 프롬프트 기반 추가 (추후 모달로 개선)
    const symbol = prompt('종목 코드 (예: 005930, AAPL):');
    if (!symbol) return;
    const market = prompt('시장 (KR 또는 US):');
    if (!market) return;
    const name = prompt('종목명:');
    if (!name) return;
    const quantity = parseFloat(prompt('수량:'));
    if (!quantity) return;
    const avgPrice = parseFloat(prompt('평균매수가:'));
    if (!avgPrice) return;
    const currency = market.toUpperCase() === 'KR' ? '₩' : '$';

    api('/api/portfolio/holdings', {
        method: 'POST',
        body: JSON.stringify({ symbol: symbol.toUpperCase(), market: market.toUpperCase(), name, quantity, avg_price: avgPrice, currency }),
    }).then(() => loadPortfolio()).catch(err => alert('추가 실패: ' + err.message));
}

function formatMoney(val) {
    if (Math.abs(val) >= 1e8) return `${(val / 1e8).toFixed(1)}억`;
    if (Math.abs(val) >= 1e4) return `${(val / 1e4).toFixed(0)}만`;
    return val.toLocaleString();
}
