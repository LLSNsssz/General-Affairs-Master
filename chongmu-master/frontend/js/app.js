const API = '';

// ═══════════════════════════════════════
//  Navigation
// ═══════════════════════════════════════
document.querySelectorAll('.sidebar nav a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + link.dataset.page).classList.add('active');
    loadPage(link.dataset.page);
  });
});

function navigateTo(page) {
  document.querySelector(`.sidebar nav a[data-page="${page}"]`).click();
}

function loadPage(page) {
  const loaders = {
    'dashboard': loadDashboard,
    'certificates': loadCertificates,
    'vehicles': loadVehicles,
    'tax-clearances': loadTaxClearances,
    'seals': loadSeals,
    'contracts': loadContracts,
  };
  if (loaders[page]) loaders[page]();
}

// ═══════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════
function fmt(d) { return d || '-'; }

function badgeFor(status) {
  const map = {
    '유효': 'badge-valid', '사용중': 'badge-active', '운행중': 'badge-active',
    '진행중': 'badge-active', '만료': 'badge-expired', '폐기': 'badge-expired',
    '해지': 'badge-expired', '갱신필요': 'badge-warning', '정비중': 'badge-warning',
    '분실': 'badge-expired', '반납': 'badge-warning'
  };
  return `<span class="badge ${map[status] || ''}">${status}</span>`;
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

async function apiJson(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json().catch(() => null);
}

// ═══════════════════════════════════════
//  Drag & Drop Upload (전역)
// ═══════════════════════════════════════
function initDropZone(el) {
  ['dragenter', 'dragover'].forEach(evt =>
    el.addEventListener(evt, e => { e.preventDefault(); el.classList.add('drop-hover'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    el.addEventListener(evt, e => { e.preventDefault(); el.classList.remove('drop-hover'); })
  );
  el.addEventListener('drop', async e => {
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    await uploadFiles(files);
  });
}

// 파일 선택 버튼
function onFileSelect(input) {
  const files = [...input.files];
  if (files.length) uploadFiles(files);
  input.value = '';
}

async function uploadFiles(files) {
  const log = document.getElementById('upload-log');
  log.innerHTML = '<div class="upload-progress">업로드 중...</div>';
  log.style.display = 'block';

  const results = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(API + '/api/upload/', { method: 'POST', body: fd });
      const data = await res.json();
      results.push(data);
    } catch (err) {
      results.push({ file: file.name, message: '업로드 실패: ' + err.message });
    }
  }

  // 결과 표시
  log.innerHTML = results.map(r => {
    const icon = r.id ? '\u2705' : (r.category === 'unknown' ? '\u26A0\uFE0F' : '\u274C');
    return `<div class="upload-result">${icon} <strong>${r.file}</strong> — ${r.message}</div>`;
  }).join('');

  // 현재 페이지 새로고침
  const activePage = document.querySelector('.sidebar nav a.active')?.dataset.page;
  if (activePage) loadPage(activePage);

  setTimeout(() => { log.style.display = 'none'; }, 5000);
}

// ═══════════════════════════════════════
//  Dashboard
// ═══════════════════════════════════════

// 알림 규칙: 카테고리별 만료 D-day 기준
const ALERT_RULES = {
  '4대보험': 3,
  '국세': 7,
  '지방세': 7,
};

async function loadDashboard() {
  const [certs, vehicles, taxes, seals, contracts] = await Promise.all([
    apiJson('/api/certificates/'), apiJson('/api/vehicles/'),
    apiJson('/api/tax-clearances/'), apiJson('/api/seals/'), apiJson('/api/contracts/')
  ]);

  // 통계 카드
  const statsGrid = document.getElementById('stats-grid');
  const items = [
    { icon: '\u2605', label: '인증서', count: certs.length, page: 'certificates' },
    { icon: '\u{1F698}', label: '차량', count: vehicles.length, page: 'vehicles' },
    { icon: '\u{1F4C4}', label: '완납증명서', count: taxes.length, page: 'tax-clearances' },
    { icon: '\u{1F4CD}', label: '직생', count: seals.length, page: 'seals' },
    { icon: '\u{1F4DD}', label: '계약문서', count: contracts.length, page: 'contracts' },
  ];
  statsGrid.innerHTML = items.map(s => `
    <div class="stat-card" onclick="navigateTo('${s.page}')">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.count}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  // 알림 목록
  const alerts = [];

  // 완납증명서: 카테고리별 다른 기준
  taxes.forEach(t => {
    const d = daysUntil(t.expiry_date);
    const threshold = ALERT_RULES[t.clearance_type] ?? 7;
    if (d <= threshold && d > -30) {
      alerts.push({
        name: `[완납] ${t.clearance_type} ${t.sub_type || ''}`,
        date: t.expiry_date, days: d, threshold,
        urgent: d <= 0
      });
    }
  });

  // 인증서: 30일 전
  certs.forEach(c => {
    const d = daysUntil(c.expiry_date);
    if (d <= 30 && d > -30) {
      alerts.push({ name: `[인증서] ${c.cert_name}`, date: c.expiry_date, days: d });
    }
  });

  // 차량: 보험/리스 30일 전
  vehicles.forEach(v => {
    [{ field: v.insurance_expiry, label: '보험만료' },
     { field: v.lease_end, label: '리스종료' }].forEach(({ field, label }) => {
      const d = daysUntil(field);
      if (d <= 30 && d > -30) {
        alerts.push({ name: `[차량 ${label}] ${v.plate_number}`, date: field, days: d });
      }
    });
  });

  // 계약: 30일 전
  contracts.forEach(c => {
    const d = daysUntil(c.end_date);
    if (d <= 30 && d > -30) {
      alerts.push({ name: `[계약] ${c.title}`, date: c.end_date, days: d });
    }
  });

  alerts.sort((a, b) => a.days - b.days);

  const alertList = document.getElementById('alert-list');
  if (alerts.length === 0) {
    alertList.innerHTML = '<li class="empty-state">만료 임박 항목이 없습니다</li>';
  } else {
    alertList.innerHTML = alerts.map(a => {
      let badge;
      if (a.days < 0) badge = `<span class="badge badge-expired">${Math.abs(a.days)}일 경과</span>`;
      else if (a.days <= 3) badge = `<span class="badge badge-expired">D-${a.days}</span>`;
      else badge = `<span class="badge badge-warning">D-${a.days}</span>`;
      return `<li><span>${a.name}</span><span>${badge} (${a.date})</span></li>`;
    }).join('');
  }
}

// ═══════════════════════════════════════
//  CRUD 테이블 로딩
// ═══════════════════════════════════════

function certRow(r) {
  return `<tr>
    <td>${r.cert_type}</td><td>${r.cert_name}</td><td>${fmt(r.issuer)}</td>
    <td>${fmt(r.cert_number)}</td><td>${fmt(r.issue_date)}</td><td>${fmt(r.expiry_date)}</td>
    <td>${badgeFor(r.status)}</td>
    <td>
      <button class="btn btn-sm btn-primary" onclick='editCert(${JSON.stringify(r)})'>수정</button>
      <button class="btn btn-sm btn-danger" onclick="delItem('/api/certificates/${r.id}','certificates')">삭제</button>
    </td>
  </tr>`;
}

async function loadCertificates() {
  const [latest, archived] = await Promise.all([
    apiJson('/api/certificates/?archive=0'),
    apiJson('/api/certificates/?archive=1'),
  ]);
  const tbody = document.querySelector('#cert-table tbody');
  tbody.innerHTML = latest.length === 0
    ? '<tr><td colspan="8" class="empty-state">파일을 끌어다 놓으면 자동 등록됩니다</td></tr>'
    : latest.map(certRow).join('');

  const section = document.getElementById('cert-archive-section');
  if (archived.length > 0) {
    section.style.display = 'block';
    section.querySelector('.archive-count').textContent = `(${archived.length}건)`;
    document.querySelector('#cert-archive-table tbody').innerHTML = archived.map(certRow).join('');
  } else {
    section.style.display = 'none';
  }
}

function taxRow(r) {
  return `<tr>
    <td>${r.clearance_type}</td><td>${fmt(r.sub_type)}</td><td>${fmt(r.issuer)}</td>
    <td>${fmt(r.cert_number)}</td><td>${fmt(r.issue_date)}</td><td>${fmt(r.expiry_date)}</td>
    <td>${badgeFor(r.status)}</td>
    <td>
      <button class="btn btn-sm btn-primary" onclick='editTax(${JSON.stringify(r)})'>수정</button>
      <button class="btn btn-sm btn-danger" onclick="delItem('/api/tax-clearances/${r.id}','tax-clearances')">삭제</button>
    </td>
  </tr>`;
}

async function loadTaxClearances() {
  const [latest, archived] = await Promise.all([
    apiJson('/api/tax-clearances/?archive=0'),
    apiJson('/api/tax-clearances/?archive=1'),
  ]);
  const tbody = document.querySelector('#tax-table tbody');
  tbody.innerHTML = latest.length === 0
    ? '<tr><td colspan="8" class="empty-state">파일을 끌어다 놓으면 자동 등록됩니다</td></tr>'
    : latest.map(taxRow).join('');

  const section = document.getElementById('tax-archive-section');
  if (archived.length > 0) {
    section.style.display = 'block';
    section.querySelector('.archive-count').textContent = `(${archived.length}건)`;
    document.querySelector('#tax-archive-table tbody').innerHTML = archived.map(taxRow).join('');
  } else {
    section.style.display = 'none';
  }
}

async function loadVehicles() {
  const data = await apiJson('/api/vehicles/');
  const tbody = document.querySelector('#vehicle-table tbody');
  tbody.innerHTML = data.length === 0 ? '<tr><td colspan="8" class="empty-state">파일을 끌어다 놓으면 자동 등록됩니다</td></tr>' :
    data.map(r => `<tr>
      <td>${r.plate_number}</td><td>${r.vehicle_name}</td><td>${fmt(r.owner)}</td>
      <td>${fmt(r.lease_company)}</td><td>${fmt(r.lease_end)}</td><td>${fmt(r.insurance_expiry)}</td>
      <td>${badgeFor(r.status)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick='editVehicle(${JSON.stringify(r)})'>수정</button>
        <button class="btn btn-sm btn-danger" onclick="delItem('/api/vehicles/${r.id}','vehicles')">삭제</button>
      </td>
    </tr>`).join('');
}

async function loadSeals() {
  const data = await apiJson('/api/seals/');
  const tbody = document.querySelector('#seal-table tbody');
  tbody.innerHTML = data.length === 0 ? '<tr><td colspan="7" class="empty-state">파일을 끌어다 놓으면 자동 등록됩니다</td></tr>' :
    data.map(r => `<tr>
      <td>${r.seal_type}</td><td>${r.seal_name}</td><td>${fmt(r.holder)}</td>
      <td>${fmt(r.purpose)}</td><td>${fmt(r.register_date)}</td>
      <td>${badgeFor(r.status)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick='editSeal(${JSON.stringify(r)})'>수정</button>
        <button class="btn btn-sm btn-danger" onclick="delItem('/api/seals/${r.id}','seals')">삭제</button>
      </td>
    </tr>`).join('');
}

async function loadContracts() {
  const data = await apiJson('/api/contracts/');
  const tbody = document.querySelector('#contract-table tbody');
  tbody.innerHTML = data.length === 0 ? '<tr><td colspan="9" class="empty-state">파일을 끌어다 놓으면 자동 등록됩니다</td></tr>' :
    data.map(r => `<tr>
      <td>${fmt(r.order_number)}</td><td>${fmt(r.institution)}</td>
      <td>${r.contract_type}</td><td>${r.title}</td>
      <td>${fmt(r.contract_amount)}</td><td>${fmt(r.start_date)}</td><td>${fmt(r.end_date)}</td>
      <td>${badgeFor(r.status)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick='editContract(${JSON.stringify(r)})'>수정</button>
        <button class="btn btn-sm btn-danger" onclick="delItem('/api/contracts/${r.id}','contracts')">삭제</button>
      </td>
    </tr>`).join('');
}

// 과거자료 토글
function toggleArchive(prefix) {
  const table = document.getElementById(`${prefix}-archive-table`);
  table.style.display = table.style.display === 'none' ? 'table' : 'none';
}

async function delItem(url, page) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  await apiJson(url, { method: 'DELETE' });
  loadPage(page);
}

// ═══════════════════════════════════════
//  Modal (수정용)
// ═══════════════════════════════════════
function closeModal(e) {
  if (e && e.target.id !== 'modal-backdrop') return;
  document.getElementById('modal-backdrop').classList.remove('open');
}
function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-backdrop').classList.add('open');
}

function formData(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) obj[k] = v || null;
  return obj;
}

// ── 수정 폼 ──
function editCert(d) {
  showModal(`<h3>인증서 수정</h3>
  <form onsubmit="submitEdit(event, '/api/certificates/${d.id}', 'certificates')">
    <div class="form-group"><label>구분</label>
      <select name="cert_type">${['여성기업','중소기업','벤처기업','이노비즈','메인비즈','ISO','기타'].map(t => `<option ${d.cert_type===t?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="form-group"><label>인증서명</label><input name="cert_name" value="${d.cert_name||''}" required></div>
    <div class="form-group"><label>발급기관</label><input name="issuer" value="${d.issuer||''}"></div>
    <div class="form-group"><label>인증번호</label><input name="cert_number" value="${d.cert_number||''}"></div>
    <div class="form-group"><label>발급일</label><input type="date" name="issue_date" value="${d.issue_date||''}"></div>
    <div class="form-group"><label>만료일</label><input type="date" name="expiry_date" value="${d.expiry_date||''}"></div>
    <div class="form-group"><label>상태</label><select name="status">${['유효','만료','갱신필요'].map(s => `<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="form-group"><label>비고</label><textarea name="memo">${d.memo||''}</textarea></div>
    <div class="form-actions"><button type="button" class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary">저장</button></div>
  </form>`);
}

function editVehicle(d) {
  showModal(`<h3>차량 수정</h3>
  <form onsubmit="submitEdit(event, '/api/vehicles/${d.id}', 'vehicles')">
    <div class="form-group"><label>차량번호</label><input name="plate_number" value="${d.plate_number||''}" required></div>
    <div class="form-group"><label>차종</label><input name="vehicle_name" value="${d.vehicle_name||''}" required></div>
    <div class="form-group"><label>사용자</label><input name="owner" value="${d.owner||''}"></div>
    <div class="form-group"><label>리스회사</label><input name="lease_company" value="${d.lease_company||''}"></div>
    <div class="form-group"><label>리스 시작일</label><input type="date" name="lease_start" value="${d.lease_start||''}"></div>
    <div class="form-group"><label>리스 종료일</label><input type="date" name="lease_end" value="${d.lease_end||''}"></div>
    <div class="form-group"><label>보험회사</label><input name="insurance_company" value="${d.insurance_company||''}"></div>
    <div class="form-group"><label>보험 만료일</label><input type="date" name="insurance_expiry" value="${d.insurance_expiry||''}"></div>
    <div class="form-group"><label>정기검사일</label><input type="date" name="inspection_date" value="${d.inspection_date||''}"></div>
    <div class="form-group"><label>상태</label><select name="status">${['운행중','정비중','반납'].map(s => `<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="form-group"><label>비고</label><textarea name="memo">${d.memo||''}</textarea></div>
    <div class="form-actions"><button type="button" class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary">저장</button></div>
  </form>`);
}

function editTax(d) {
  showModal(`<h3>완납증명서 수정</h3>
  <form onsubmit="submitEdit(event, '/api/tax-clearances/${d.id}', 'tax-clearances')">
    <div class="form-group"><label>구분</label><select name="clearance_type">${['4대보험','국세','지방세'].map(t => `<option ${d.clearance_type===t?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="form-group"><label>세부구분</label><select name="sub_type"><option value="">-</option>${['국민연금','건강보험','고용보험','산재보험','기타'].map(t => `<option ${d.sub_type===t?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="form-group"><label>발급기관</label><input name="issuer" value="${d.issuer||''}"></div>
    <div class="form-group"><label>증명번호</label><input name="cert_number" value="${d.cert_number||''}"></div>
    <div class="form-group"><label>발급일</label><input type="date" name="issue_date" value="${d.issue_date||''}"></div>
    <div class="form-group"><label>만료일</label><input type="date" name="expiry_date" value="${d.expiry_date||''}"></div>
    <div class="form-group"><label>상태</label><select name="status">${['유효','만료','갱신필요'].map(s => `<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="form-group"><label>비고</label><textarea name="memo">${d.memo||''}</textarea></div>
    <div class="form-actions"><button type="button" class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary">저장</button></div>
  </form>`);
}

function editSeal(d) {
  showModal(`<h3>직인/생인 수정</h3>
  <form onsubmit="submitEdit(event, '/api/seals/${d.id}', 'seals')">
    <div class="form-group"><label>구분</label><select name="seal_type">${['직인','사용인감','법인인감','기타'].map(t => `<option ${d.seal_type===t?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="form-group"><label>인감명</label><input name="seal_name" value="${d.seal_name||''}" required></div>
    <div class="form-group"><label>보관자</label><input name="holder" value="${d.holder||''}"></div>
    <div class="form-group"><label>용도</label><input name="purpose" value="${d.purpose||''}"></div>
    <div class="form-group"><label>등록일</label><input type="date" name="register_date" value="${d.register_date||''}"></div>
    <div class="form-group"><label>상태</label><select name="status">${['사용중','폐기','분실'].map(s => `<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="form-group"><label>비고</label><textarea name="memo">${d.memo||''}</textarea></div>
    <div class="form-actions"><button type="button" class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary">저장</button></div>
  </form>`);
}

function editContract(d) {
  showModal(`<h3>계약 수정</h3>
  <form onsubmit="submitEdit(event, '/api/contracts/${d.id}', 'contracts')">
    <div class="form-group"><label>수주번호</label><input name="order_number" value="${d.order_number||''}"></div>
    <div class="form-group"><label>기관 (발주처)</label><input name="institution" value="${d.institution||''}"></div>
    <div class="form-group"><label>구분</label><select name="contract_type">${['임대차','용역','구매','유지보수','기타'].map(t => `<option ${d.contract_type===t?'selected':''}>${t}</option>`).join('')}</select></div>
    <div class="form-group"><label>계약명</label><input name="title" value="${d.title||''}" required></div>
    <div class="form-group"><label>계약상대방</label><input name="counterpart" value="${d.counterpart||''}"></div>
    <div class="form-group"><label>금액</label><input name="contract_amount" value="${d.contract_amount||''}"></div>
    <div class="form-group"><label>시작일</label><input type="date" name="start_date" value="${d.start_date||''}"></div>
    <div class="form-group"><label>종료일</label><input type="date" name="end_date" value="${d.end_date||''}"></div>
    <div class="form-group"><label>자동갱신</label><select name="auto_renew"><option value="N" ${d.auto_renew==='N'?'selected':''}>N</option><option value="Y" ${d.auto_renew==='Y'?'selected':''}>Y</option></select></div>
    <div class="form-group"><label>담당자</label><input name="manager" value="${d.manager||''}"></div>
    <div class="form-group"><label>상태</label><select name="status">${['진행중','만료','해지'].map(s => `<option ${d.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="form-group"><label>비고</label><textarea name="memo">${d.memo||''}</textarea></div>
    <div class="form-actions"><button type="button" class="btn" onclick="closeModal()">취소</button><button class="btn btn-primary">저장</button></div>
  </form>`);
}

async function submitEdit(e, url, page) {
  e.preventDefault();
  await apiJson(url, { method: 'PUT', body: JSON.stringify(formData(e.target)) });
  document.getElementById('modal-backdrop').classList.remove('open');
  loadPage(page);
}

// ═══════════════════════════════════════
//  Init
// ═══════════════════════════════════════
document.querySelectorAll('.drop-zone').forEach(initDropZone);
loadDashboard();
