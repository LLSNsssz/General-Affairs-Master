/**
 * Chart.js 유틸리티
 */
const chartDefaults = {
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
        },
    },
    scales: {
        x: {
            grid: { color: 'rgba(30,41,59,0.5)' },
            ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } },
        },
        y: {
            grid: { color: 'rgba(30,41,59,0.5)' },
            ticks: { color: '#64748b', font: { size: 11 } },
        },
    },
};

function createPriceChart(ctx, labels, prices, extraDatasets = []) {
    const isUp = prices[prices.length - 1] >= prices[0];
    const lineColor = isUp ? '#ef4444' : '#3b82f6';
    const bgColor = isUp ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)';

    const datasets = [
        {
            label: '종가',
            data: prices,
            borderColor: lineColor,
            backgroundColor: bgColor,
            borderWidth: 2,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHitRadius: 10,
        },
        ...extraDatasets,
    ];

    return new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: { ...chartDefaults },
    });
}

function createVolumeChart(ctx, labels, volumes, prices) {
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '거래량',
                data: volumes,
                backgroundColor: volumes.map((_, i) =>
                    i > 0 && prices[i] >= prices[i - 1]
                        ? 'rgba(239,68,68,0.5)'
                        : 'rgba(59,130,246,0.5)'
                ),
                borderRadius: 2,
            }],
        },
        options: {
            ...chartDefaults,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: {
                    grid: { color: 'rgba(30,41,59,0.5)' },
                    ticks: {
                        color: '#64748b',
                        font: { size: 10 },
                        callback: v => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}K`,
                    },
                },
            },
        },
    });
}

function createRSIChart(ctx, labels, rsiData) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'RSI',
                data: rsiData,
                borderColor: '#a78bfa',
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                pointRadius: 0,
            }],
        },
        options: {
            ...chartDefaults,
            scales: {
                ...chartDefaults.scales,
                y: {
                    ...chartDefaults.scales.y,
                    min: 0,
                    max: 100,
                    ticks: {
                        color: '#64748b',
                        stepSize: 10,
                        font: { size: 10 },
                    },
                },
            },
            plugins: {
                ...chartDefaults.plugins,
                annotation: {
                    annotations: {
                        overbought: { type: 'line', yMin: 70, yMax: 70, borderColor: '#ef4444', borderWidth: 1, borderDash: [5, 5] },
                        oversold: { type: 'line', yMin: 30, yMax: 30, borderColor: '#3b82f6', borderWidth: 1, borderDash: [5, 5] },
                    },
                },
            },
        },
    });
}
