const API_BASE = '';
let currentMarket = 'all';
let stocksData = [];
let priceChart = null;
let volumeChart = null;
let currentChartStock = null;
let ws = null;
let autoRefreshInterval = null;

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadStocks();
    setupEventListeners();
    startAutoRefresh();
});

function setupEventListeners() {
    // 시장 필터
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMarket = btn.dataset.market;
            loadStocks();
        });
    });

    // 새로고침
    document.getElementById('refreshBtn').addEventListener('click', loadStocks);

    // 검색
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => searchStocks(searchInput.value), 300);
    });
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            document.getElementById('searchResults').classList.remove('show');
        }, 200);
    });

    // 차트 닫기
    document.getElementById('closeChart').addEventListener('click', closeChart);
    document.getElementById('chartModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeChart();
    });

    // 차트 기간
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (currentChartStock) {
                loadChart(currentChartStock.market, currentChartStock.symbol, parseInt(btn.dataset.days));
            }
        });
    });

    // ESC 키
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeChart();
    });
}

async function loadStocks() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('loading');
    btn.textContent = '로딩중...';

    try {
        const res = await fetch(`${API_BASE}/api/stocks?market=${currentMarket}`);
        const data = await res.json();
        stocksData = data.stocks;
        renderStocks(stocksData);
        document.getElementById('updateTime').textContent =
            `마지막 업데이트: ${new Date(data.updated_at).toLocaleTimeString('ko-KR')}`;
    } catch (err) {
        document.getElementById('stockGrid').innerHTML =
            '<div class="loading">데이터를 불러올 수 없습니다. 서버 연결을 확인하세요.</div>';
    } finally {
        btn.classList.remove('loading');
        btn.textContent = '새로고침';
    }
}

function renderStocks(stocks) {
    const grid = document.getElementById('stockGrid');
    if (!stocks.length) {
        grid.innerHTML = '<div class="loading">데이터가 없습니다.</div>';
        return;
    }

    grid.innerHTML = stocks.map((stock, i) => {
        const changeClass = stock.change > 0 ? 'up' : stock.change < 0 ? 'down' : 'flat';
        const changeSign = stock.change > 0 ? '+' : '';
        const formattedPrice = stock.market === 'KR'
            ? `${stock.currency}${stock.price.toLocaleString()}`
            : `${stock.currency}${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const formattedVolume = stock.volume >= 1000000
            ? `${(stock.volume / 1000000).toFixed(1)}M`
            : stock.volume >= 1000
            ? `${(stock.volume / 1000).toFixed(1)}K`
            : stock.volume.toLocaleString();

        return `
            <div class="stock-card" onclick="openChart('${stock.market.toLowerCase()}', '${stock.symbol}')" style="animation-delay: ${i * 0.05}s">
                <div class="card-header">
                    <div>
                        <div class="stock-name">${stock.name}</div>
                        <div class="stock-symbol">${stock.symbol}</div>
                    </div>
                    <span class="market-badge ${stock.market.toLowerCase()}">${stock.market}</span>
                </div>
                <div class="price-section">
                    <div class="price">${formattedPrice}</div>
                    <div class="change ${changeClass}">${changeSign}${stock.change}%</div>
                </div>
                <div class="card-footer">
                    <span>
                        <span class="label">거래량</span>
                        <span class="value">${formattedVolume}</span>
                    </span>
                    <span>
                        <span class="label">고가</span>
                        <span class="value">${stock.currency}${stock.high.toLocaleString()}</span>
                    </span>
                    <span>
                        <span class="label">저가</span>
                        <span class="value">${stock.currency}${stock.low.toLocaleString()}</span>
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

async function openChart(market, symbol) {
    const stock = stocksData.find(s => s.symbol === symbol);
    if (!stock) return;

    currentChartStock = stock;
    document.getElementById('chartTitle').textContent = `${stock.name} (${stock.symbol})`;
    document.getElementById('chartModal').classList.remove('hidden');

    // 상세정보
    const detail = document.getElementById('stockDetail');
    detail.innerHTML = `
        <div class="detail-item">
            <div class="detail-label">시가</div>
            <div class="detail-value">${stock.currency}${stock.open.toLocaleString()}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">고가</div>
            <div class="detail-value">${stock.currency}${stock.high.toLocaleString()}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">저가</div>
            <div class="detail-value">${stock.currency}${stock.low.toLocaleString()}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">거래량</div>
            <div class="detail-value">${stock.volume.toLocaleString()}</div>
        </div>
    `;

    // 기본 1개월 차트
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.period-btn[data-days="30"]').classList.add('active');
    await loadChart(market, symbol, 30);
}

async function loadChart(market, symbol, days) {
    try {
        const res = await fetch(`${API_BASE}/api/chart/${market}/${symbol}?days=${days}`);
        const data = await res.json();

        if (!data.chart.length) return;

        const labels = data.chart.map(d => d.date);
        const prices = data.chart.map(d => d.close);
        const volumes = data.chart.map(d => d.volume);

        // 가격 차트
        if (priceChart) priceChart.destroy();
        const priceCtx = document.getElementById('priceChart').getContext('2d');

        const isUp = prices[prices.length - 1] >= prices[0];
        const lineColor = isUp ? '#ef4444' : '#3b82f6';
        const bgColor = isUp ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)';

        priceChart = new Chart(priceCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: '종가',
                    data: prices,
                    borderColor: lineColor,
                    backgroundColor: bgColor,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHitRadius: 10,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#94a3b8',
                        bodyColor: '#fff',
                        bodyFont: { weight: '600' },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(30, 41, 59, 0.5)' },
                        ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(30, 41, 59, 0.5)' },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    }
                }
            }
        });

        // 거래량 차트
        if (volumeChart) volumeChart.destroy();
        const volCtx = document.getElementById('volumeChart').getContext('2d');

        volumeChart = new Chart(volCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '거래량',
                    data: volumes,
                    backgroundColor: volumes.map((_, i) =>
                        i > 0 && prices[i] >= prices[i - 1]
                            ? 'rgba(239, 68, 68, 0.5)'
                            : 'rgba(59, 130, 246, 0.5)'
                    ),
                    borderRadius: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        bodyColor: '#fff',
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: ctx => `거래량: ${ctx.raw.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: { display: false },
                    y: {
                        grid: { color: 'rgba(30, 41, 59, 0.5)' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 10 },
                            callback: v => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`
                        }
                    }
                }
            }
        });

    } catch (err) {
        console.error('Chart load error:', err);
    }
}

function closeChart() {
    document.getElementById('chartModal').classList.add('hidden');
    currentChartStock = null;
}

async function searchStocks(query) {
    const resultsDiv = document.getElementById('searchResults');
    if (!query.trim()) {
        resultsDiv.classList.remove('show');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (data.results.length) {
            resultsDiv.innerHTML = data.results.map(r => `
                <div class="search-result-item" onclick="openChart('${r.market.toLowerCase()}', '${r.symbol}')">
                    <div>
                        <span class="symbol">${r.symbol}</span>
                        <span style="margin-left: 8px; color: #94a3b8">${r.name}</span>
                    </div>
                    <span class="market-tag">${r.market}</span>
                </div>
            `).join('');
            resultsDiv.classList.add('show');
        } else {
            resultsDiv.innerHTML = '<div class="search-result-item" style="color: #64748b">결과 없음</div>';
            resultsDiv.classList.add('show');
        }
    } catch (err) {
        resultsDiv.classList.remove('show');
    }
}

// 모바일 하단 네비게이션 전환
function switchView(market) {
    currentMarket = market;
    // 하단 네비 활성화
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === market);
    });
    // 상단 필터도 동기화
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.market === market);
    });
    loadStocks();
}

function startAutoRefresh() {
    autoRefreshInterval = setInterval(loadStocks, 30000);
}

// WebSocket 연결 (선택사항)
function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => console.log('WebSocket connected');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'update') {
            stocksData = data.stocks;
            renderStocks(stocksData);
            document.getElementById('updateTime').textContent =
                `마지막 업데이트: ${new Date(data.updated_at).toLocaleTimeString('ko-KR')}`;
        }
    };
    ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
}
