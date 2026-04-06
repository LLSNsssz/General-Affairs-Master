const consoleOutput = document.getElementById("consoleOutput");
const statusBadge = document.getElementById("serviceStatus");
const playerList = document.getElementById("playerList");
const jobTable = document.getElementById("jobTable");
const deliveryTable = document.getElementById("deliveryTable");
const refreshButton = document.getElementById("refreshButton");
const autoRefresh = document.getElementById("autoRefresh");

const playerCount = document.getElementById("playerCount");
const jobCount = document.getElementById("jobCount");
const completedCount = document.getElementById("completedCount");
const deliveryCount = document.getElementById("deliveryCount");

const registerForm = document.getElementById("registerForm");
const enhanceForm = document.getElementById("enhanceForm");
const webhookForm = document.getElementById("webhookForm");

let refreshTimer = null;

function log(message, type = "info") {
  const stamp = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  const prefix = type === "error" ? "[ERROR]" : type === "success" ? "[OK]" : "[LOG]";
  consoleOutput.textContent = `[${stamp}] ${prefix} ${message}\n` + consoleOutput.textContent;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = payload && (payload.message || payload.error || payload.raw) || response.statusText;
    throw new Error(message);
  }

  return payload;
}

function setStatus(ok, message) {
  statusBadge.textContent = message;
  statusBadge.classList.toggle("ok", ok);
  statusBadge.classList.toggle("error", !ok);
}

function renderPlayers(players) {
  playerCount.textContent = players.length;

  if (!players.length) {
    playerList.innerHTML = `<div class="empty">등록된 플레이어가 없습니다.</div>`;
    return;
  }

  playerList.innerHTML = players.map((player) => `
    <article class="player-card" data-player-id="${escapeHtml(player.PlayerId)}" data-user-id="${escapeHtml(player.UserId)}" data-display-name="${escapeHtml(player.DisplayName)}" data-current-level="${player.CurrentLevel}">
      <h4>${escapeHtml(player.DisplayName)}</h4>
      <div>${escapeHtml(player.PlayerId)}</div>
      <div class="player-meta">
        <span class="pill">${escapeHtml(player.UserId)}</span>
        <span class="pill level">+${player.CurrentLevel}</span>
      </div>
    </article>
  `).join("");

  playerList.querySelectorAll(".player-card").forEach((card) => {
    card.addEventListener("click", () => fillFormsFromPlayer(card.dataset));
  });
}

function renderJobs(jobs) {
  jobCount.textContent = jobs.length;
  completedCount.textContent = jobs.filter((job) => job.Status === "succeeded").length;

  if (!jobs.length) {
    jobTable.innerHTML = `<tr><td colspan="4" class="empty">작업이 없습니다.</td></tr>`;
    return;
  }

  jobTable.innerHTML = jobs.map((job) => `
    <tr>
      <td><span class="job-status ${escapeHtml(job.Status)}">${escapeHtml(job.Status)}</span></td>
      <td>${escapeHtml(job.PlayerId)}</td>
      <td>+${job.TargetLevel}</td>
      <td>${escapeHtml(job.LastMessage || "-")}</td>
    </tr>
  `).join("");
}

function renderDeliveries(logs) {
  deliveryCount.textContent = logs.length;

  if (!logs.length) {
    deliveryTable.innerHTML = `<tr><td colspan="4" class="empty">전송 로그가 없습니다.</td></tr>`;
    return;
  }

  deliveryTable.innerHTML = logs.map((logItem) => `
    <tr>
      <td>${escapeHtml(logItem.Channel || "-")}</td>
      <td>${escapeHtml(logItem.Recipient || "-")}</td>
      <td>${escapeHtml(logItem.Result || "-")}</td>
      <td>${escapeHtml(logItem.Payload || "-")}</td>
    </tr>
  `).join("");
}

function fillFormsFromPlayer(player) {
  registerForm.playerId.value = player.playerId;
  registerForm.userId.value = player.userId;
  registerForm.displayName.value = player.displayName;
  registerForm.currentLevel.value = player.currentLevel;

  enhanceForm.userId.value = player.userId;
  enhanceForm.playerId.value = player.playerId;
  enhanceForm.requestedBy.value = player.userId;

  webhookForm.userId.value = player.userId;
  webhookForm.playerId.value = player.playerId;

  log(`${player.displayName} 선택 완료`);
}

async function refreshAll() {
  try {
    const [health, players, jobs, deliveries] = await Promise.all([
      requestJson("/health"),
      requestJson("/players"),
      requestJson("/jobs"),
      requestJson("/delivery-logs")
    ]);

    setStatus(true, `정상 동작 중 · ${new Date(health.nowUtc).toLocaleTimeString("ko-KR", { hour12: false })}`);
    renderPlayers(players);
    renderJobs(jobs);
    renderDeliveries(deliveries);
  } catch (error) {
    setStatus(false, "연결 실패");
    log(error.message, "error");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setAutoRefresh(enabled) {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  if (enabled) {
    refreshTimer = setInterval(refreshAll, 3000);
  }
}

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const playerId = registerForm.playerId.value.trim();
  const body = {
    userId: registerForm.userId.value.trim(),
    displayName: registerForm.displayName.value.trim(),
    currentLevel: Number(registerForm.currentLevel.value)
  };

  try {
    const result = await requestJson(`/players/${encodeURIComponent(playerId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body)
    });

    log(`플레이어 저장: ${result.player.DisplayName}`, "success");
    await refreshAll();
  } catch (error) {
    log(`플레이어 저장 실패: ${error.message}`, "error");
  }
});

enhanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = {
    userId: enhanceForm.userId.value.trim(),
    playerId: enhanceForm.playerId.value.trim(),
    targetLevel: Number(enhanceForm.targetLevel.value),
    requestedBy: enhanceForm.requestedBy.value.trim(),
    source: "web-ui"
  };

  try {
    const result = await requestJson("/commands/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body)
    });

    log(`강화 요청 등록: job=${result.jobId} 목표=+${result.targetLevel}`, "success");
    await refreshAll();
  } catch (error) {
    log(`강화 요청 실패: ${error.message}`, "error");
  }
});

webhookForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = {
    userId: webhookForm.userId.value.trim(),
    playerId: webhookForm.playerId.value.trim(),
    message: webhookForm.message.value.trim()
  };

  try {
    const result = await requestJson("/kakao/channel/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body)
    });

    log(`채널 응답: ${result.replyText}`, "success");
    await refreshAll();
  } catch (error) {
    log(`채널 명령 실패: ${error.message}`, "error");
  }
});

refreshButton.addEventListener("click", refreshAll);
autoRefresh.addEventListener("change", () => setAutoRefresh(autoRefresh.checked));

setAutoRefresh(true);
refreshAll();
