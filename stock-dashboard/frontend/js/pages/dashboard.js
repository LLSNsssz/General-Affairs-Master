/**
 * 대시보드 페이지 - 종목 그리드
 */
let dashboardStocks = [];
let dashboardSignals = {};

async function loadDashboard() {
    const grid = document.getElementById('view-dashboard');
    grid.innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';

    try {
        const res = await api('/api/stocks?market=all');
        dashboardStocks = res.stocks || [];
        document.getElementById('updateTime').textContent =
            `마지막 업데이트: ${new Date(res.updated_at).toLocaleTimeString('ko-KR')}`;
        renderDashboard();
    } catch (err) {
        grid.innerHTML = '<div class="loading">데이터를 불러올 수 없습니다.</div>';
    }
}

function renderDashboard() {
    const grid = document.getElementById('view-dashboard');
    if (!dashboardStocks.length) {
        grid.innerHTML = '<div class="loading">데이터가 없습니다.</div>';
        return;
    }

    // 시장별 섹션
    const krStocks = dashboardStocks.filter(s => s.market === 'KR');
    const usStocks = dashboardStocks.filter(s => s.market === 'US');

    grid.innerHTML = `
        <div class="section-title">한국 주식 <span class="count">${krStocks.length}</span></div>
        <div class="stock-grid">${krStocks.map((s, i) => renderStockCard(s, i)).join('')}</div>
        <div class="section-title" style="margin-top:24px">미국 주식 <span class="count">${usStocks.length}</span></div>
        <div class="stock-grid">${usStocks.map((s, i) => renderStockCard(s, i)).join('')}</div>
    `;
}

function renderStockCard(stock, i) {
    const changeClass = stock.change > 0 ? 'up' : stock.change < 0 ? 'down' : 'flat';
    const changeSign = stock.change > 0 ? '+' : '';
    const formattedPrice = stock.market === 'KR'
        ? `${stock.currency}${stock.price.toLocaleString()}`
        : `${stock.currency}${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formattedVolume = stock.volume >= 1e6
        ? `${(stock.volume / 1e6).toFixed(1)}M`
        : stock.volume >= 1e3
        ? `${(stock.volume / 1e3).toFixed(1)}K`
        : stock.volume.toLocaleString();

    const sig = dashboardSignals[`${stock.market}:${stock.symbol}`];
    const signalDot = sig ? createSignalDot(sig.level, sig.is_capitulation) : '';

    return `
        <div class="stock-card" onclick="openAnalysis('${stock.market.toLowerCase()}', '${stock.symbol}')" style="animation-delay:${i * 0.03}s">
            <div class="card-header">
                <div>
                    <div class="stock-name">${signalDot} ${stock.name}</div>
                    <div class="stock-symbol">${stock.symbol}</div>
                </div>
                <span class="market-badge ${stock.market.toLowerCase()}">${stock.market}</span>
            </div>
            <div class="price-section">
                <div class="price">${formattedPrice}</div>
                <div class="change ${changeClass}">${changeSign}${stock.change}%</div>
            </div>
            <div class="card-footer">
                <span><span class="label">거래량</span><span class="value">${formattedVolume}</span></span>
                <span><span class="label">고가</span><span class="value">${stock.currency}${stock.high.toLocaleString()}</span></span>
                <span><span class="label">저가</span><span class="value">${stock.currency}${stock.low.toLocaleString()}</span></span>
            </div>
        </div>
    `;
}
