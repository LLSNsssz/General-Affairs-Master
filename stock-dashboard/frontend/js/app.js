/**
 * Stock Dashboard - SPA Core
 */
const API_BASE = '';  // 같은 호스트 (배포시 변경)
let currentView = 'dashboard';
let currentUser = null;  // {id, email} or null
let autoRefreshTimer = null;

// --- API Client ---
async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (currentUser?.token) {
        headers['Authorization'] = `Bearer ${currentUser.token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
}

// --- SPA Navigation ---
function navigateTo(view) {
    currentView = view;

    // 뷰 전환
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.add('active');

    // 네비 활성화
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.view === view);
    });

    // 페이지 로드
    switch (view) {
        case 'dashboard': loadDashboard(); break;
        case 'signals': loadSignals(); break;
        case 'portfolio': loadPortfolio(); break;
    }
}

// --- Search ---
function setupSearch() {
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    let timeout;

    input.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
            const q = input.value.trim();
            if (!q) { results.classList.remove('show'); return; }
            try {
                const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
                if (data.results.length) {
                    results.innerHTML = data.results.map(r => `
                        <div class="search-result-item" onclick="openAnalysis('${r.market.toLowerCase()}', '${r.symbol}'); document.getElementById('searchResults').classList.remove('show');">
                            <div><span class="symbol">${r.symbol}</span> <span style="color:#94a3b8">${r.name}</span></div>
                            <span class="market-tag">${r.market}</span>
                        </div>
                    `).join('');
                    results.classList.add('show');
                } else {
                    results.innerHTML = '<div class="search-result-item" style="color:#64748b">결과 없음</div>';
                    results.classList.add('show');
                }
            } catch (_) {
                results.classList.remove('show');
            }
        }, 300);
    });

    input.addEventListener('blur', () => setTimeout(() => results.classList.remove('show'), 200));
}

// --- Auth ---
function loadSavedAuth() {
    try {
        const saved = localStorage.getItem('auth_user');
        if (saved) {
            currentUser = JSON.parse(saved);
        }
    } catch (_) {}
}

function showLogin() {
    window.location.href = '/login';
}

function logout() {
    currentUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    updateAuthUI();
    if (currentView === 'portfolio') loadPortfolio();
}

function updateAuthUI() {
    const btn = document.getElementById('authBtn');
    if (currentUser) {
        btn.textContent = '로그아웃';
        btn.onclick = logout;
    } else {
        btn.textContent = '로그인';
        btn.onclick = showLogin;
    }
}

// --- Auto Refresh ---
function startAutoRefresh() {
    autoRefreshTimer = setInterval(() => {
        if (currentView === 'dashboard') loadDashboard();
    }, 30000);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    loadSavedAuth();
    setupSearch();
    updateAuthUI();
    startAutoRefresh();

    document.getElementById('refreshBtn').addEventListener('click', () => {
        navigateTo(currentView);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAnalysis();
    });

    // 첫 로드
    navigateTo('dashboard');
});
