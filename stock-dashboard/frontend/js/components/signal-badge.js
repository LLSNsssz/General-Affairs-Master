/**
 * 신호등 배지 컴포넌트
 */
function createSignalBadge(level, score, isCapitulation) {
    const colors = {
        GREEN: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', text: '순항' },
        YELLOW: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', text: '관망' },
        RED: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', text: '위험' },
    };
    const c = colors[level] || colors.YELLOW;
    const capClass = isCapitulation ? ' capitulation' : '';

    return `<span class="signal-badge${capClass}" style="background:${c.bg};color:${c.color}">
        <span class="signal-dot" style="background:${c.color}"></span>
        ${isCapitulation ? '극단적 공포' : c.text} ${score}
    </span>`;
}

function createSignalDot(level, isCapitulation) {
    const colors = { GREEN: '#22c55e', YELLOW: '#eab308', RED: '#ef4444' };
    const color = colors[level] || colors.YELLOW;
    const cls = isCapitulation ? 'signal-dot-sm capitulation-dot' : 'signal-dot-sm';
    return `<span class="${cls}" style="background:${color}"></span>`;
}
