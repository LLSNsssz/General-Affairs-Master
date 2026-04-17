/**
 * 대시보드 페이지 - 종목 그리드
 */
let dashboardStocks = [];
let dashboardSignals = {};
let dashboardWatchlist = [];
let dashboardLoadPromise = null;

async function loadDashboard(options = {}) {
    if (dashboardLoadPromise) {
        return dashboardLoadPromise;
    }

    dashboardLoadPromise = (async () => {
        const grid = document.getElementById('view-dashboard');
        const fresh = options.fresh === true;
        const freshQuery = fresh ? '&fresh=1' : '';
        grid.innerHTML = '<div class="loading">데이터를 불러오는 중...</div>';

        try {
            const [stocksRes, watchlist] = await Promise.all([
                api(`/api/stocks?market=all${freshQuery}`),
                loadDashboardWatchlist(fresh),
            ]);

            dashboardStocks = stocksRes.stocks || [];
            dashboardWatchlist = watchlist;

            const updatedAt = stocksRes.updated_at ? new Date(stocksRes.updated_at) : null;
            document.getElementById('updateTime').textContent =
                updatedAt && !Number.isNaN(updatedAt.getTime())
                    ? `마지막 업데이트: ${updatedAt.toLocaleTimeString('ko-KR')}`
                    : '마지막 업데이트: -';

            renderDashboard();
        } catch (err) {
            grid.innerHTML = '<div class="loading">데이터를 불러올 수 없습니다.</div>';
        } finally {
            dashboardLoadPromise = null;
        }
    })();

    return dashboardLoadPromise;
}

async function loadDashboardWatchlist(fresh = false) {
    if (!currentUser) {
        return [];
    }

    try {
        const res = await api(`/api/watchlist${fresh ? '?fresh=1' : ''}`);
        return res.watchlist || [];
    } catch (err) {
        if (err.message.includes('401')) {
            return [];
        }
        console.error('Failed to load watchlist', err);
        return [];
    }
}

function renderDashboard() {
    const grid = document.getElementById('view-dashboard');
    const sections = [];

    if (currentUser) {
        sections.push(renderWatchlistSection());
    }

    if (dashboardStocks.length) {
        const krStocks = dashboardStocks.filter(stock => stock.market === 'KR');
        const usStocks = dashboardStocks.filter(stock => stock.market === 'US');

        sections.push(renderStockSection('한국 주식', krStocks));
        sections.push(renderStockSection('미국 주식', usStocks, true));
    }

    if (!sections.length) {
        grid.innerHTML = '<div class="loading">데이터가 없습니다.</div>';
        return;
    }

    grid.innerHTML = sections.join('');
}

function renderWatchlistSection() {
    const title = `
        <div class="section-title">
            관심 종목
            <span class="count">${dashboardWatchlist.length}</span>
            <button class="add-btn" onclick="showAddWatchlistModal()">+ 추가</button>
        </div>
    `;

    if (!dashboardWatchlist.length) {
        return `
            ${title}
            <div class="inline-empty-state">
                <div>
                    <strong>관심 종목이 아직 없습니다.</strong>
                    <span>자주 보는 종목을 저장해 두면 대시보드 상단에서 바로 확인할 수 있습니다.</span>
                </div>
                <button class="primary-btn secondary-btn" onclick="showAddWatchlistModal()">종목 추가</button>
            </div>
        `;
    }

    return `
        ${title}
        <div class="stock-grid watchlist-grid">
            ${dashboardWatchlist.map((stock, index) => renderStockCard(stock, index, {
                cardClass: 'watchlist-card',
                actionHtml: `
                    <button
                        class="card-icon-btn"
                        title="관심 종목 삭제"
                        aria-label="관심 종목 삭제"
                        onclick="event.stopPropagation(); removeWatchlistItem('${stock.market}', '${stock.symbol}')"
                    >
                        ×
                    </button>
                `,
            })).join('')}
        </div>
    `;
}

function renderStockSection(title, stocks, withTopMargin = false) {
    const sectionClass = withTopMargin ? 'section-title section-spacer' : 'section-title';

    return `
        <div class="${sectionClass}">${title} <span class="count">${stocks.length}</span></div>
        <div class="stock-grid">${stocks.map((stock, index) => renderStockCard(stock, index)).join('')}</div>
    `;
}

function renderStockCard(stock, index, options = {}) {
    const market = String(stock.market || '').toUpperCase();
    const symbol = String(stock.symbol || '').toUpperCase();
    const name = stock.name || symbol;
    const currency = stock.currency || (market === 'KR' ? '₩' : '$');
    const price = Number(stock.price || 0);
    const change = Number(stock.change || 0);
    const high = Number(stock.high || 0);
    const low = Number(stock.low || 0);
    const volume = Number(stock.volume || 0);
    const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const changeSign = change > 0 ? '+' : '';
    const sig = dashboardSignals[`${market}:${symbol}`];
    const signalDot = sig ? createSignalDot(sig.level, sig.is_capitulation) : '';

    return `
        <div
            class="stock-card ${options.cardClass || ''}"
            onclick="openAnalysis('${market.toLowerCase()}', '${symbol}')"
            style="animation-delay:${index * 0.03}s"
        >
            <div class="card-header">
                <div>
                    <div class="stock-name">${signalDot} ${name}</div>
                    <div class="stock-symbol">${symbol}</div>
                </div>
                <div class="card-actions">
                    <span class="market-badge ${market.toLowerCase()}">${market}</span>
                    ${options.actionHtml || ''}
                </div>
            </div>
            <div class="price-section">
                <div class="price">${formatStockPrice(price, market, currency)}</div>
                <div class="change ${changeClass}">${changeSign}${change}%</div>
            </div>
            <div class="card-footer">
                <span><span class="label">거래량</span><span class="value">${formatCompactNumber(volume)}</span></span>
                <span><span class="label">고가</span><span class="value">${formatMetricPrice(high, market, currency)}</span></span>
                <span><span class="label">저가</span><span class="value">${formatMetricPrice(low, market, currency)}</span></span>
            </div>
        </div>
    `;
}

function formatStockPrice(price, market, currency) {
    if (market === 'KR') {
        return `${currency}${price.toLocaleString()}`;
    }

    return `${currency}${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatMetricPrice(price, market, currency) {
    if (market === 'KR') {
        return `${currency}${price.toLocaleString()}`;
    }

    return `${currency}${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatCompactNumber(value) {
    if (value >= 1e6) {
        return `${(value / 1e6).toFixed(1)}M`;
    }
    if (value >= 1e3) {
        return `${(value / 1e3).toFixed(1)}K`;
    }
    return value.toLocaleString();
}

async function showAddWatchlistModal() {
    if (!currentUser) {
        showLogin();
        return;
    }

    const query = prompt('추가할 종목명 또는 코드를 입력하세요.');
    if (!query) {
        return;
    }

    try {
        const data = await api(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const results = (data.results || []).slice(0, 10);

        if (!results.length) {
            alert('검색 결과가 없습니다.');
            return;
        }

        const target = results.length === 1 ? results[0] : chooseSearchResult(results);
        if (!target) {
            return;
        }

        await api('/api/watchlist', {
            method: 'POST',
            body: JSON.stringify({
                symbol: target.symbol,
                market: target.market,
                name: target.name,
            }),
        });

        await loadDashboard();
    } catch (err) {
        alert(`관심 종목 추가 실패: ${err.message}`);
    }
}

function chooseSearchResult(results) {
    const options = results
        .map((item, idx) => `${idx + 1}. ${item.name} (${item.symbol}, ${item.market})`)
        .join('\n');
    const raw = prompt(`추가할 종목 번호를 선택하세요.\n${options}`, '1');

    if (!raw) {
        return null;
    }

    const selectedIndex = Number(raw) - 1;
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= results.length) {
        alert('번호를 다시 확인해주세요.');
        return null;
    }

    return results[selectedIndex];
}

async function removeWatchlistItem(market, symbol) {
    if (!currentUser) {
        return;
    }

    if (!confirm(`${symbol}을 관심 종목에서 제거할까요?`)) {
        return;
    }

    try {
        await api(`/api/watchlist/${market}/${symbol}`, { method: 'DELETE' });
        dashboardWatchlist = dashboardWatchlist.filter(
            item => !(item.market === market && item.symbol === symbol),
        );
        renderDashboard();
    } catch (err) {
        alert(`관심 종목 삭제 실패: ${err.message}`);
    }
}
