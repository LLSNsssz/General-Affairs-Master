// @ts-nocheck
// Incremental TypeScript migration source-of-truth for the renderer entry.

const SITE_PRESETS = [
  {
    id: "novelpia",
    key: "1",
    name: "Novelpia",
    url: "https://novelpia.com/",
    loginUrl: "https://novelpia.com/page/login"
  },
  {
    id: "munpia",
    key: "2",
    name: "Munpia",
    url: "https://novel.munpia.com/",
    mobileUrl: "https://m.munpia.com/",
    loginUrl: "https://nssl.munpia.com/login"
  },
  {
    id: "series",
    key: "3",
    name: "Series",
    url: "https://series.naver.com/novel/home.series",
    mobileUrl: "https://m.series.naver.com/novel/recommendList.series",
    loginUrl: "https://nid.naver.com/nidlogin.login"
  },
  {
    id: "kakaopage",
    key: "4",
    name: "KakaoPage",
    url: "https://page.kakao.com/",
    loginUrl: "https://accounts.kakao.com/login/?continue=https%3A%2F%2Fpage.kakao.com%2F"
  },
  {
    id: "joara",
    key: "5",
    name: "Joara",
    url: "https://www.joara.com/",
    loginUrl: "https://auth.joara.com/"
  }
];

const DEFAULT_BOOKMARKS = SITE_PRESETS.map((site) => ({
  id: site.id,
  name: site.name,
  url: getPresetHomeUrl(site),
  meta: getPresetMeta(site)
}));

const DEFAULT_SETTINGS = {
  fontSize: 18,
  lineHeight: 1.9
};

const STORAGE_KEYS = {
  bookmarks: "sticky.desktop.bookmarks",
  recentPages: "sticky.desktop.recentPages",
  settings: "sticky.desktop.settings",
  currentUrl: "sticky.desktop.currentUrl",
  simplifyEnabled: "sticky.desktop.simplifyEnabled"
};

const DEFAULT_STAGE_NOTICE = {
  eyebrow: "Loading",
  title: "Preparing the reading board",
  body: "The page is being refreshed inside the embedded browser."
};

const state = {
  bookmarks: mergePresetBookmarks(loadJson(STORAGE_KEYS.bookmarks, DEFAULT_BOOKMARKS)),
  recentPages: loadJson(STORAGE_KEYS.recentPages, []),
  settings: loadJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  currentUrl: getInitialUrl(),
  simplifyEnabled: localStorage.getItem(STORAGE_KEYS.simplifyEnabled) === "true",
  ambientThemeKey: "",
  windowMeta: {
    collapsed: false,
    alwaysOnTop: false
  }
};

const elements = {};
let activeDrawer = "";
let siteSwitchToastTimer = 0;
let loadingFallbackTimer = 0;
const windowDrag = {
  active: false,
  pointerId: null,
  requestId: 0,
  originX: 0,
  originY: 0,
  startScreenX: 0,
  startScreenY: 0,
  moved: false
};

document.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("error", handleGlobalError);
window.addEventListener("unhandledrejection", handleUnhandledRejection);

function initialize() {
  cacheElements();
  bindEvents();
  applySettings();
  renderBookmarks();
  renderRecentPages();
  renderHelpSiteList();
  renderState();
  attachWebviewEvents();
  hydrateWindowState();
  hydrateShortcutCommands();
  queueInitialNavigation();
}

function cacheElements() {
  elements.bookmarkList = document.querySelector("#bookmark-list");
  elements.bookmarkForm = document.querySelector("#bookmark-form");
  elements.bookmarkName = document.querySelector("#bookmark-name");
  elements.bookmarkUrl = document.querySelector("#bookmark-url");
  elements.recentList = document.querySelector("#recent-list");
  elements.addressForm = document.querySelector("#address-form");
  elements.addressInput = document.querySelector("#address-input");
  elements.browserStage = document.querySelector(".browser-stage");
  elements.titleHitArea = document.querySelector("#title-hit-area");
  elements.toggleHelpButton = document.querySelector("#toggle-help");
  elements.helpPopup = document.querySelector("#help-popup");
  elements.closeHelpButton = document.querySelector("#close-help");
  elements.siteHelpList = document.querySelector("#site-help-list");
  elements.closeWindowButton = document.querySelector("#close-window");
  elements.minimizeWindowButton = document.querySelector("#minimize-window");
  elements.maximizeWindowButton = document.querySelector("#maximize-window");
  elements.backButton = document.querySelector("#go-back");
  elements.forwardButton = document.querySelector("#go-forward");
  elements.reloadButton = document.querySelector("#reload-page");
  elements.toggleSimplifyButton = document.querySelector("#toggle-simplify");
  elements.toggleBookmarksButton = document.querySelector("#toggle-bookmarks");
  elements.toggleHistoryButton = document.querySelector("#toggle-history");
  elements.toggleSettingsButton = document.querySelector("#toggle-settings");
  elements.statusText = document.querySelector("#status-text");
  elements.pageTitle = document.querySelector("#page-title");
  elements.stagePlaceholder = document.querySelector("#stage-placeholder");
  elements.stagePlaceholderEyebrow = document.querySelector("#stage-placeholder .eyebrow");
  elements.stagePlaceholderTitle = document.querySelector("#stage-placeholder h2");
  elements.stagePlaceholderBody = document.querySelector("#stage-placeholder .muted");
  elements.siteSwitchToast = document.querySelector("#site-switch-toast");
  elements.webview = document.querySelector("#reader-webview");
  elements.bookmarkDrawer = document.querySelector("#bookmark-drawer");
  elements.recentDrawer = document.querySelector("#recent-drawer");
  elements.settingsDrawer = document.querySelector("#settings-drawer");
  elements.fontSize = document.querySelector("#font-size");
  elements.fontSizeValue = document.querySelector("#font-size-value");
  elements.lineHeight = document.querySelector("#line-height");
  elements.lineHeightValue = document.querySelector("#line-height-value");
}

function bindEvents() {
  if (elements.bookmarkForm) {
    elements.bookmarkForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addBookmark(elements.bookmarkName.value, elements.bookmarkUrl.value);
      elements.bookmarkForm.reset();
    });
  }

  if (elements.addressForm && elements.addressInput) {
    elements.addressForm.addEventListener("submit", (event) => {
      event.preventDefault();
      navigateTo(elements.addressInput.value);
    });
  }

  if (elements.toggleBookmarksButton) {
    elements.toggleBookmarksButton.addEventListener("click", () => toggleDrawer("bookmarks"));
  }

  if (elements.toggleHistoryButton) {
    elements.toggleHistoryButton.addEventListener("click", () => toggleDrawer("history"));
  }

  if (elements.toggleSettingsButton) {
    elements.toggleSettingsButton.addEventListener("click", () => toggleDrawer("settings"));
  }

  if (elements.toggleHelpButton) {
    elements.toggleHelpButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setHelpPopupOpen(!elements.helpPopup?.classList.contains("is-open"));
    });
  }

  if (elements.closeHelpButton) {
    elements.closeHelpButton.addEventListener("click", () => {
      setHelpPopupOpen(false);
    });
  }

  if (elements.titleHitArea) {
    elements.titleHitArea.addEventListener("pointerdown", startWindowDrag);
    elements.titleHitArea.addEventListener("dblclick", async () => {
      stopWindowDrag();
      setHelpPopupOpen(false);
      const nextState = await window.stickyDesktop?.toggleCollapsedWindow();
      applyWindowState(nextState);
    });

    elements.titleHitArea.addEventListener("contextmenu", async (event) => {
      stopWindowDrag();
      event.preventDefault();
      setHelpPopupOpen(false);
      const nextState = await window.stickyDesktop?.toggleAlwaysOnTopWindow();
      applyWindowState(nextState);
    });
  }

  if (elements.closeWindowButton) {
    elements.closeWindowButton.addEventListener("click", () => {
      if (window.stickyDesktop?.closeWindow) {
        window.stickyDesktop.closeWindow();
        return;
      }

      window.close();
    });
  }

  if (elements.backButton) {
    elements.backButton.addEventListener("click", () => {
      if (elements.webview.canGoBack()) {
        elements.webview.goBack();
      }
    });
  }

  if (elements.forwardButton) {
    elements.forwardButton.addEventListener("click", () => {
      if (elements.webview.canGoForward()) {
        elements.webview.goForward();
      }
    });
  }

  if (elements.reloadButton) {
    elements.reloadButton.addEventListener("click", () => {
      state.simplifyEnabled = false;
      persistScalar(STORAGE_KEYS.simplifyEnabled, "false");
      updateSimplifyButton();
      elements.webview.reload();
    });
  }

  if (elements.toggleSimplifyButton) {
    elements.toggleSimplifyButton.addEventListener("click", async () => {
      if (state.simplifyEnabled) {
        state.simplifyEnabled = false;
        persistScalar(STORAGE_KEYS.simplifyEnabled, "false");
        updateSimplifyButton();
        elements.webview.reload();
        setStatus("Returned to the original page");
        return;
      }

      await applySimplifyMode();
    });
  }

  if (elements.fontSize) {
    elements.fontSize.addEventListener("input", async () => {
      state.settings.fontSize = Number(elements.fontSize.value);
      applySettings();
      persistJson(STORAGE_KEYS.settings, state.settings);
      if (state.simplifyEnabled) {
        await applySimplifyMode();
      }
    });
  }

  if (elements.lineHeight) {
    elements.lineHeight.addEventListener("input", async () => {
      state.settings.lineHeight = Number(elements.lineHeight.value);
      applySettings();
      persistJson(STORAGE_KEYS.settings, state.settings);
      if (state.simplifyEnabled) {
        await applySimplifyMode();
      }
    });
  }

  if (elements.browserStage) {
    elements.browserStage.addEventListener("click", () => {
      closeDrawers();
      setHelpPopupOpen(false);
    });
  }

  document.addEventListener("pointerdown", (event) => {
    if (!elements.helpPopup || elements.helpPopup.classList.contains("is-hidden")) {
      return;
    }

    const target = event.target;
    if (target instanceof Node && (elements.helpPopup.contains(target) || elements.toggleHelpButton?.contains(target))) {
      return;
    }

    setHelpPopupOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (handleSiteShortcutKeydown(event)) {
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleDrawer("bookmarks");
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      toggleDrawer("history");
      return;
    }

    if (event.ctrlKey && event.key === ",") {
      event.preventDefault();
      toggleDrawer("settings");
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      elements.webview.reload();
      return;
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
      event.preventDefault();
      window.stickyDesktop?.toggleAlwaysOnTopWindow().then(applyWindowState);
      return;
    }

    if ((event.altKey && event.key === "ArrowLeft") || (event.ctrlKey && !event.shiftKey && event.code === "BracketLeft")) {
      event.preventDefault();
      goBackCurrentPage();
      return;
    }

    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      if (elements.webview.canGoForward()) {
        elements.webview.goForward();
      }
      return;
    }

    if (event.key === "Escape") {
      if (elements.helpPopup && !elements.helpPopup.classList.contains("is-hidden")) {
        setHelpPopupOpen(false);
        return;
      }
      closeDrawers();
    }
  });

  document.addEventListener("pointermove", handleWindowDragMove);
  document.addEventListener("pointerup", stopWindowDrag);
  document.addEventListener("pointercancel", stopWindowDrag);
  window.addEventListener("blur", stopWindowDrag);
}

function handleGlobalError(event) {
  const message = event?.error?.message || event?.message || "Renderer error";
  console.error(event?.error || message);
  setLoading(true);
  setStageNotice("Error", "Renderer problem", message);
  setStatus(`Error: ${message}`);
}

function handleUnhandledRejection(event) {
  const reason = event?.reason;
  const message = reason?.message || String(reason || "Unhandled rejection");
  console.error(reason);
  setLoading(true);
  setStageNotice("Error", "Async problem", message);
  setStatus(`Error: ${message}`);
}

function hydrateShortcutCommands() {
  if (window.stickyDesktop?.onShortcutCommand) {
    window.stickyDesktop.onShortcutCommand((command) => {
      handleShortcutCommand(command);
    });
  }
}

function attachWebviewEvents() {
  if (!elements.webview) {
    return;
  }

  elements.webview.addEventListener("dom-ready", async () => {
    setLoading(false);
    await applyAmbientPageTheme();
    await hideWebviewScrollbars();
    if (state.simplifyEnabled) {
      await applySimplifyMode();
    }
  });

  elements.webview.addEventListener("did-start-loading", () => {
    setLoading(true);
    setStatus("Loading page inside desktop viewer");
    window.clearTimeout(loadingFallbackTimer);
    loadingFallbackTimer = window.setTimeout(() => {
      setLoading(false);
    }, 3500);
  });

  elements.webview.addEventListener("did-stop-loading", async () => {
    window.clearTimeout(loadingFallbackTimer);
    setLoading(false);
    await applyAmbientPageTheme();
    await hideWebviewScrollbars();
    syncNavigationState();
    setStatus("Ready");

    if (state.simplifyEnabled) {
      await applySimplifyMode();
    }
  });

  elements.webview.addEventListener("did-navigate", () => {
    syncNavigationState();
  });

  elements.webview.addEventListener("did-navigate-in-page", () => {
    syncNavigationState();
  });

  elements.webview.addEventListener("page-title-updated", (event) => {
    if (elements.pageTitle) {
      elements.pageTitle.textContent = event.title || simplifyHost(state.currentUrl);
    }
    syncNavigationState();
  });

  elements.webview.addEventListener("did-fail-load", () => {
    window.clearTimeout(loadingFallbackTimer);
    setLoading(true);
    setStageNotice("Error", "Page could not load", "Check the site URL or try another preset.");
    setStatus("Could not load the requested page");
  });
}

function renderState() {
  if (elements.addressInput) {
    elements.addressInput.value = state.currentUrl;
  }
  if (elements.pageTitle) {
    elements.pageTitle.textContent = simplifyHost(state.currentUrl);
  }
  renderHelpSiteList();
  updateSimplifyButton();
  renderWindowState();
  renderDrawers();
}

function queueInitialNavigation() {
  if (!elements.webview) {
    return;
  }

  setLoading(true);
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      if (elements.webview && state.currentUrl) {
        elements.webview.src = state.currentUrl;
      }
    }, 40);
  });
}

function renderBookmarks() {
  elements.bookmarkList.replaceChildren();

  if (state.bookmarks.length === 0) {
    elements.bookmarkList.append(createEmpty("No bookmarks yet"));
    return;
  }

  state.bookmarks.forEach((bookmark) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bookmark-link";
    button.innerHTML = [
      `<span class="bookmark-title">${escapeHtml(bookmark.name)}</span>`,
      `<span class="bookmark-meta">${escapeHtml(bookmark.meta || simplifyHost(bookmark.url))}</span>`
    ].join("");
    button.addEventListener("click", () => {
      closeDrawers();
      navigateTo(bookmark.url);
    });
    elements.bookmarkList.append(button);
  });
}

function renderRecentPages() {
  elements.recentList.replaceChildren();

  if (state.recentPages.length === 0) {
    elements.recentList.append(createEmpty("No history yet"));
    return;
  }

  state.recentPages.forEach((page) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-link";
    button.innerHTML = [
      `<span class="recent-title">${escapeHtml(page.title)}</span>`,
      `<span class="recent-meta">${escapeHtml(page.hostname)} | ${escapeHtml(page.visitedAt)}</span>`
    ].join("");
    button.addEventListener("click", () => {
      closeDrawers();
      navigateTo(page.url);
    });
    elements.recentList.append(button);
  });
}

function applySettings() {
  if (elements.fontSize) {
    elements.fontSize.value = String(state.settings.fontSize);
  }
  if (elements.fontSizeValue) {
    elements.fontSizeValue.value = `${state.settings.fontSize}px`;
  }
  if (elements.lineHeight) {
    elements.lineHeight.value = String(state.settings.lineHeight);
  }
  if (elements.lineHeightValue) {
    elements.lineHeightValue.value = state.settings.lineHeight.toFixed(1);
  }
}

function updateSimplifyButton() {
  if (!elements.toggleSimplifyButton) {
    return;
  }

  elements.toggleSimplifyButton.classList.toggle("is-active", state.simplifyEnabled);
  elements.toggleSimplifyButton.textContent = state.simplifyEnabled ? "PAGE" : "TEXT";
}

function toggleDrawer(drawerName) {
  setHelpPopupOpen(false);
  activeDrawer = activeDrawer === drawerName ? "" : drawerName;
  renderDrawers();
}

function closeDrawers() {
  if (!activeDrawer) {
    return;
  }

  activeDrawer = "";
  renderDrawers();
}

function setHelpPopupOpen(isOpen) {
  if (!elements.helpPopup) {
    return;
  }

  elements.helpPopup.classList.toggle("is-hidden", !isOpen);
  elements.helpPopup.classList.toggle("is-open", isOpen);
  elements.toggleHelpButton?.classList.toggle("is-active", isOpen);

  if (isOpen) {
    closeDrawers();
    renderHelpSiteList();
  }
}

function renderDrawers() {
  elements.bookmarkDrawer?.classList.toggle("is-open", activeDrawer === "bookmarks");
  elements.recentDrawer?.classList.toggle("is-open", activeDrawer === "history");
  elements.settingsDrawer?.classList.toggle("is-open", activeDrawer === "settings");

  elements.toggleBookmarksButton?.classList.toggle("is-active", activeDrawer === "bookmarks");
  elements.toggleHistoryButton?.classList.toggle("is-active", activeDrawer === "history");
  elements.toggleSettingsButton?.classList.toggle("is-active", activeDrawer === "settings");
}

function renderHelpSiteList() {
  if (!elements.siteHelpList) {
    return;
  }

  const currentIndex = findPresetIndexByUrl(state.currentUrl);
  elements.siteHelpList.replaceChildren();

  SITE_PRESETS.forEach((site, index) => {
    const row = document.createElement("div");
    row.className = "help-site-row";
    row.classList.toggle("is-current", index === currentIndex);

    const copy = document.createElement("div");
    copy.className = "help-site-copy";
    copy.innerHTML = [
      `<span class="help-site-name">${escapeHtml(site.name)}</span>`,
      `<span class="help-site-meta">Ctrl+${escapeHtml(site.key)} | Ctrl+Shift+${escapeHtml(site.key)}</span>`
    ].join("");

    const actions = document.createElement("div");
    actions.className = "help-site-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "help-action-button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => {
      switchToSitePreset(index);
      setHelpPopupOpen(false);
    });

    const loginButton = document.createElement("button");
    loginButton.type = "button";
    loginButton.className = "help-action-button";
    loginButton.textContent = "Login";
    loginButton.addEventListener("click", () => {
      openSiteLogin(index);
      setHelpPopupOpen(false);
    });

    actions.append(openButton, loginButton);
    row.append(copy, actions);
    elements.siteHelpList.append(row);
  });
}

function renderWindowState() {
  document.body.classList.toggle("is-collapsed", Boolean(state.windowMeta.collapsed));
  document.body.classList.toggle("is-pinned", Boolean(state.windowMeta.alwaysOnTop));
}

function applyWindowState(nextState) {
  if (!nextState) {
    return;
  }

  state.windowMeta = {
    collapsed: Boolean(nextState.collapsed),
    alwaysOnTop: Boolean(nextState.alwaysOnTop)
  };
  renderWindowState();
}

function handleShortcutCommand(command) {
  if (!command || typeof command !== "object") {
    return;
  }

  if (command.type === "switch-site") {
    switchToSitePreset(command.index);
    return;
  }

  if (command.type === "open-site-login") {
    openSiteLogin(command.index);
    return;
  }

  if (command.type === "open-current-login") {
    openCurrentSiteLogin();
    return;
  }

  if (command.type === "go-back") {
    goBackCurrentPage();
    return;
  }

  if (command.type === "cycle-site") {
    cycleSitePreset(command.step);
  }
}

function handleSiteShortcutKeydown(event) {
  if (!event.ctrlKey || event.altKey || event.metaKey) {
    return false;
  }

  const directIndex = findPresetIndexFromShortcutEvent(event);
  if (directIndex !== -1) {
    event.preventDefault();
    if (event.shiftKey) {
      openSiteLogin(directIndex);
      return true;
    }

    switchToSitePreset(directIndex);
    return true;
  }

  if (!event.shiftKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    openCurrentSiteLogin();
    return true;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    cycleSitePreset(event.shiftKey ? -1 : 1);
    return true;
  }

  return false;
}

function switchToSitePreset(index) {
  const site = SITE_PRESETS[index];
  if (!site) {
    return;
  }

  setHelpPopupOpen(false);
  showSiteActionToast(site, `Ctrl+${site.key}`);
  navigateTo(getPresetHomeUrl(site));
}

function openSiteLogin(index) {
  const site = SITE_PRESETS[index];
  if (!site) {
    return;
  }

  setHelpPopupOpen(false);
  showSiteActionToast(site, `Login | Ctrl+Shift+${site.key}`);
  navigateTo(getPresetLoginUrl(site));
}

function openCurrentSiteLogin() {
  const currentIndex = findPresetIndexByUrl(state.currentUrl);
  if (currentIndex === -1) {
    setStatus("Current page does not match a quick-login site");
    return;
  }

  openSiteLogin(currentIndex);
}

function cycleSitePreset(step) {
  const direction = Number(step) >= 0 ? 1 : -1;
  const currentIndex = findPresetIndexByUrl(state.currentUrl);
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (baseIndex + direction + SITE_PRESETS.length) % SITE_PRESETS.length;
  switchToSitePreset(nextIndex);
}

function findPresetIndexByUrl(url) {
  return SITE_PRESETS.findIndex((site) => {
    return urlsShareHost(url, site.url) || urlsShareHost(url, site.mobileUrl) || urlsShareHost(url, site.loginUrl);
  });
}

function findPresetIndexFromShortcutEvent(event) {
  const codeMatch = /^Digit([1-5])$/.exec(String(event.code || ""));
  if (codeMatch) {
    return Number(codeMatch[1]) - 1;
  }

  return SITE_PRESETS.findIndex((site) => site.key === event.key);
}

function showSiteActionToast(site, hint) {
  if (!elements.siteSwitchToast) {
    return;
  }

  window.clearTimeout(siteSwitchToastTimer);
  elements.siteSwitchToast.innerHTML = `<strong>${escapeHtml(site.name)}</strong><span>${escapeHtml(hint)}</span>`;
  elements.siteSwitchToast.classList.remove("is-hidden");
  siteSwitchToastTimer = window.setTimeout(() => {
    elements.siteSwitchToast?.classList.add("is-hidden");
  }, 1400);
}

function goBackCurrentPage() {
  if (!elements.webview?.canGoBack()) {
    setStatus("No previous page");
    return;
  }

  elements.webview.goBack();
}

async function startWindowDrag(event) {
  if (event.button !== 0 || !window.stickyDesktop?.getWindowBounds) {
    return;
  }

  const requestId = windowDrag.requestId + 1;
  windowDrag.requestId = requestId;
  const bounds = await window.stickyDesktop.getWindowBounds();
  if (!bounds || requestId !== windowDrag.requestId) {
    return;
  }

  windowDrag.active = true;
  windowDrag.pointerId = event.pointerId;
  windowDrag.originX = bounds.x;
  windowDrag.originY = bounds.y;
  windowDrag.startScreenX = event.screenX;
  windowDrag.startScreenY = event.screenY;
  windowDrag.moved = false;
  document.body.classList.add("is-dragging-window");
}

function handleWindowDragMove(event) {
  if (!windowDrag.active || event.pointerId !== windowDrag.pointerId) {
    return;
  }

  const deltaX = event.screenX - windowDrag.startScreenX;
  const deltaY = event.screenY - windowDrag.startScreenY;
  if (!windowDrag.moved && Math.abs(deltaX) + Math.abs(deltaY) < 4) {
    return;
  }

  windowDrag.moved = true;
  window.stickyDesktop?.setWindowPosition(windowDrag.originX + deltaX, windowDrag.originY + deltaY);
}

function stopWindowDrag(event) {
  if (!windowDrag.active && windowDrag.pointerId == null) {
    return;
  }

  if (event && event.pointerId != null && windowDrag.pointerId != null && event.pointerId !== windowDrag.pointerId) {
    return;
  }

  windowDrag.requestId += 1;
  windowDrag.active = false;
  windowDrag.pointerId = null;
  windowDrag.moved = false;
  document.body.classList.remove("is-dragging-window");
}

async function hydrateWindowState() {
  try {
    const initialState = await window.stickyDesktop?.getWindowState();
    applyWindowState(initialState);
  } catch (error) {
    console.error(error);
  }

  if (window.stickyDesktop?.onWindowState) {
    window.stickyDesktop.onWindowState((value) => {
      applyWindowState(value);
    });
  }
}

function navigateTo(rawUrl) {
  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    setStatus("Enter a valid URL");
    return;
  }

  closeDrawers();
  state.currentUrl = targetUrl;
  state.simplifyEnabled = false;
  persistScalar(STORAGE_KEYS.currentUrl, targetUrl);
  persistScalar(STORAGE_KEYS.simplifyEnabled, "false");
  updateSimplifyButton();
  renderHelpSiteList();
  if (elements.addressInput) {
    elements.addressInput.value = targetUrl;
  }
  if (elements.webview) {
    elements.webview.src = targetUrl;
  }
  window.clearTimeout(loadingFallbackTimer);
  loadingFallbackTimer = window.setTimeout(() => {
    setLoading(false);
  }, 3500);
  setStatus(`Opening ${simplifyHost(targetUrl)}`);
}

function addBookmark(name, rawUrl) {
  const trimmedName = name.trim();
  const targetUrl = normalizeUrl(rawUrl);

  if (!trimmedName || !targetUrl) {
    setStatus("Enter both a name and a valid URL");
    return;
  }

  const bookmark = {
    id: crypto.randomUUID(),
    name: trimmedName,
    url: targetUrl,
    meta: simplifyHost(targetUrl)
  };

  state.bookmarks = [bookmark, ...state.bookmarks.filter((item) => item.url !== bookmark.url)].slice(0, 10);
  persistJson(STORAGE_KEYS.bookmarks, state.bookmarks);
  renderBookmarks();
  closeDrawers();
  setStatus("Bookmark saved");
}

function syncNavigationState() {
  if (!elements.webview) {
    return;
  }

  const currentUrl = elements.webview.getURL() || state.currentUrl;
  if (currentUrl) {
    state.currentUrl = currentUrl;
    if (elements.addressInput) {
      elements.addressInput.value = currentUrl;
    }
    persistScalar(STORAGE_KEYS.currentUrl, currentUrl);
  }

  const title = elements.webview.getTitle() || simplifyHost(currentUrl);
  if (elements.pageTitle) {
    elements.pageTitle.textContent = title;
  }
  renderHelpSiteList();
  rememberPage(currentUrl, title);
}

function mergePresetBookmarks(savedBookmarks) {
  const remainingBookmarks = Array.isArray(savedBookmarks) ? [...savedBookmarks] : [];
  const mergedPresets = SITE_PRESETS.map((site) => {
    const matchIndex = remainingBookmarks.findIndex((bookmark) => {
      return bookmark?.id === site.id || urlsShareHost(bookmark?.url, site.url) || urlsShareHost(bookmark?.url, site.mobileUrl);
    });

    if (matchIndex === -1) {
      return {
        id: site.id,
        name: site.name,
        url: getPresetHomeUrl(site),
        meta: getPresetMeta(site)
      };
    }

    const [bookmark] = remainingBookmarks.splice(matchIndex, 1);
    return {
      ...bookmark,
      id: site.id,
      name: site.name,
      url: getPresetHomeUrl(site),
      meta: getPresetMeta(site)
    };
  });

  return mergedPresets.concat(
    remainingBookmarks
      .filter((bookmark) => bookmark && bookmark.url)
      .map((bookmark) => ({
        id: bookmark.id || crypto.randomUUID(),
        name: bookmark.name || simplifyHost(bookmark.url),
        url: bookmark.url,
        meta: bookmark.meta || simplifyHost(bookmark.url)
      }))
  );
}

function getPresetHomeUrl(site) {
  return site?.mobileUrl || site?.url || "";
}

function getPresetLoginUrl(site) {
  return site?.mobileLoginUrl || site?.loginUrl || getPresetHomeUrl(site);
}

function getPresetMeta(site) {
  return `${site.mobileUrl ? "Mobile" : "Quick"} | Ctrl+${site.key}`;
}

function urlsShareHost(leftUrl, rightUrl) {
  try {
    const left = new URL(leftUrl);
    const right = new URL(rightUrl);
    return left.hostname === right.hostname || left.hostname.endsWith(`.${right.hostname}`) || right.hostname.endsWith(`.${left.hostname}`);
  } catch {
    return false;
  }
}

function rememberPage(url, title) {
  if (!url || !/^https?:/i.test(url)) {
    return;
  }

  const entry = {
    url,
    title: title || simplifyHost(url),
    hostname: simplifyHost(url),
    visitedAt: new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date())
  };

  state.recentPages = [entry, ...state.recentPages.filter((item) => item.url !== url)].slice(0, 8);
  persistJson(STORAGE_KEYS.recentPages, state.recentPages);
  renderRecentPages();
}

async function applySimplifyMode() {
  state.simplifyEnabled = true;
  persistScalar(STORAGE_KEYS.simplifyEnabled, "true");
  updateSimplifyButton();

  try {
    await elements.webview.executeJavaScript(buildSimplifyScript(state.settings), true);
    await hideWebviewScrollbars();
    setStatus("Simplified the current page");
  } catch (error) {
    console.error(error);
    state.simplifyEnabled = false;
    persistScalar(STORAGE_KEYS.simplifyEnabled, "false");
    updateSimplifyButton();
    setStatus("Could not simplify this page");
  }
}

async function applyAmbientPageTheme() {
  try {
    const currentUrl = elements.webview.getURL() || state.currentUrl;
    const authPage = isAuthPage(currentUrl);
    const minimalThemePage = shouldUseMinimalAmbientTheme(currentUrl);
    const readerChromeSuppressionCss = buildReaderChromeSuppressionCss(currentUrl);
    const readerComfortCss = buildReaderComfortCss(currentUrl);
    if (state.ambientThemeKey) {
      try {
        await elements.webview.removeInsertedCSS(state.ambientThemeKey);
      } catch (error) {
        console.error(error);
      }
      state.ambientThemeKey = "";
    }

    if (minimalThemePage && !authPage) {
      state.ambientThemeKey = await elements.webview.insertCSS(`
        html, body {
          background: #f6efb6 !important;
          color: #231f15 !important;
          scrollbar-width: none !important;
        }

        body,
        [style*='background-image'] {
          background-image: none !important;
        }

        main,
        section,
        article,
        div,
        ul,
        ol,
        li,
        dl,
        dt,
        dd,
        header,
        footer,
        nav,
        aside,
        #wrap,
        #container,
        #content,
        .wrap,
        .container,
        .content,
        [class*='wrap'],
        [id*='wrap'],
        [class*='container'],
        [id*='container'],
        [class*='content'],
        [id*='content'] {
          background-color: #f6efb6 !important;
          color: #231f15 !important;
        }

        img,
        picture,
        video,
        figure,
        source {
          display: none !important;
          visibility: hidden !important;
        }

        [class*='thumb'],
        [id*='thumb'],
        [class*='thumbnail'],
        [id*='thumbnail'],
        [class*='cover'],
        [id*='cover'],
        [class*='poster'],
        [id*='poster'],
        [class*='banner'],
        [id*='banner'] {
          background-image: none !important;
          background-color: transparent !important;
        }

        * {
          scrollbar-width: none !important;
        }

        *::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }

        ${readerChromeSuppressionCss}
        ${readerComfortCss}
        ${buildPopupCloseVisibilityCss()}
      `);
      return;
    }

    state.ambientThemeKey = await elements.webview.insertCSS(authPage ? `
      html, body {
        background: #f6efb6 !important;
        color: #231f15 !important;
        scrollbar-width: none !important;
      }

      body {
        background-image: none !important;
      }

      * {
        scrollbar-width: none !important;
      }

      *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }

      ${buildPopupCloseVisibilityCss()}
    ` : `
      html, body {
        background: #f6efb6 !important;
        color: #231f15 !important;
        scrollbar-width: none !important;
      }

      body {
        background-image: none !important;
      }

      img,
      picture,
      video,
      svg,
      canvas,
      figure,
      source {
        display: none !important;
        visibility: hidden !important;
      }

      img[src*='kakao' i],
      svg[class*='kakao' i],
      svg[id*='kakao' i],
      [class*='kakao' i] img,
      [class*='kakao' i] svg,
      [class*='kakao'] img,
      [class*='kakao'] svg,
      [id*='kakao'] img,
      [id*='kakao'] svg,
      button[aria-label*='kakao' i] img,
      button[aria-label*='kakao' i] svg,
      a[aria-label*='kakao' i] img,
      a[aria-label*='kakao' i] svg,
      img[alt*='kakao' i],
      img[src*='kakaotalk' i] {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      * {
        scrollbar-width: none !important;
        box-shadow: none !important;
      }

      *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }

      header,
      footer,
      nav,
      aside,
      [class*='banner'],
      [id*='banner'],
      [class*='advert'],
      [id*='advert'] {
        background: transparent !important;
      }

      body,
      main,
      article,
      section,
      div,
      p,
      span,
      li,
      td,
      th,
      h1,
      h2,
      h3,
      h4,
      h5,
      h6,
      a,
      strong,
      em {
        color: #231f15 !important;
        border-color: rgba(120, 109, 36, 0.24) !important;
      }

      body,
      main,
      article,
      section,
      div,
      ul,
      ol,
      table,
      tr,
      td,
      th {
        background-color: #f6efb6 !important;
        background-image: none !important;
      }

      ${buildPopupCloseVisibilityCss()}
    `);
  } catch (error) {
    console.error(error);
  }
}

async function hideWebviewScrollbars() {
  try {
    await elements.webview.insertCSS(`
      html, body {
        scrollbar-width: none !important;
      }

      ::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
    `);
  } catch (error) {
    console.error(error);
  }
}

function buildSimplifyScript(settings) {
  const serializedSettings = JSON.stringify(settings);

  return `
    (() => {
      const settings = ${serializedSettings};
      const blockedSelectors = [
        "script", "style", "noscript", "iframe", "canvas", "svg",
        "img", "picture", "video", "audio", "figure", "figcaption",
        "form", "button", "input", "textarea", "select", "nav",
        "header", "footer", "aside", "[aria-hidden='true']",
        "[class*='advert']", "[id*='advert']", "[class*='ads']",
        "[id*='ads']", "[class*='banner']", "[id*='banner']",
        "[class*='comment']", "[id*='comment']", "[class*='reply']",
        "[id*='reply']", "[class*='toolbar']", "[id*='toolbar']"
      ];

      function normalizeText(text) {
        return String(text)
          .replace(/\\r/g, "")
          .replace(/\\u00a0/g, " ")
          .replace(/\\n[ \\t]+/g, "\\n")
          .replace(/[ \\t]+\\n/g, "\\n")
          .replace(/\\n{3,}/g, "\\n\\n")
          .replace(/[ \\t]{2,}/g, " ")
          .trim();
      }

      function splitParagraphs(text) {
        return normalizeText(text)
          .split(/\\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean);
      }

      function scoreElement(element) {
        const clone = element.cloneNode(true);
        if (!(clone instanceof HTMLElement)) {
          return { score: 0, text: "" };
        }

        blockedSelectors.forEach((selector) => {
          clone.querySelectorAll(selector).forEach((node) => node.remove());
        });

        clone.querySelectorAll("br").forEach((node) => node.replaceWith("\\n"));
        clone.querySelectorAll("p, div, li, section, article, h1, h2, h3, blockquote").forEach((node) => {
          if (node.textContent && node.textContent.trim().length > 0) {
            node.append(document.createTextNode("\\n"));
          }
        });

        const text = normalizeText(clone.innerText || clone.textContent || "");
        const paragraphs = splitParagraphs(text);
        const paragraphCount = paragraphs.filter((line) => line.length > 30).length;
        const links = normalizeText([...element.querySelectorAll("a")].map((node) => node.textContent || "").join(" ")).length;
        const mediaCount = element.querySelectorAll("img, picture, video, audio, canvas, iframe, svg").length;
        const interactiveCount = element.querySelectorAll("button, input, textarea, select").length;
        const score = text.length + paragraphCount * 220 - Math.min(links * 1.4, 900) - mediaCount * 120 - interactiveCount * 90;
        return { score, text };
      }

      const selectors = [
        "#novel_content", "#revContents", ".novel_view_area", ".novel_view",
        ".viewer_contents", ".episode-content", ".ep-content", ".viewer_body",
        ".read_area", ".view_content", ".episode_viewer", "article", "main",
        "[role='main']", "[id*='content']", "[class*='content']",
        "[id*='chapter']", "[class*='chapter']", "[id*='viewer']", "[class*='viewer']"
      ];

      const candidates = [];
      const seen = new Set();
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          if (element instanceof HTMLElement && !seen.has(element)) {
            seen.add(element);
            candidates.push(element);
          }
        });
      });

      if (candidates.length === 0 && document.body) {
        candidates.push(document.body);
      }

      const best = candidates
        .map((element) => ({ element, ...scoreElement(element) }))
        .filter((item) => item.text.length > 120)
        .sort((left, right) => right.score - left.score)[0];

      if (!best) {
        return false;
      }

      const titleNode = best.element.querySelector("h1, h2, .title, [class*='title']");
      const title = normalizeText((titleNode && titleNode.textContent) || document.title || "Untitled");
      const paragraphs = splitParagraphs(best.text);
      const bodyMarkup = paragraphs
        .map((paragraph) => {
          const safeParagraph = paragraph
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
          return "<p>" + safeParagraph + "</p>";
        })
        .join("");

      document.documentElement.innerHTML = \`
        <head>
          <meta charset="utf-8" />
          <title>\${title}</title>
          <style>
            :root {
              color-scheme: light;
              --paper: #f6efb6;
              --ink: #302816;
              --ink-soft: #62543f;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              background: var(--paper);
              color: var(--ink);
              font-family: Georgia, "Times New Roman", serif;
            }
            main {
              width: min(860px, calc(100vw - 48px));
              margin: 28px auto;
              padding: 28px 32px 40px;
              border-radius: 0;
              background: var(--paper);
              box-shadow: none;
            }
            h1 {
              margin: 0;
              font-size: 2rem;
              line-height: 1.15;
              letter-spacing: -0.02em;
            }
            .meta {
              margin-top: 10px;
              color: var(--ink-soft);
              font: 12px/1.5 "Segoe UI Variable", "Malgun Gothic", sans-serif;
              text-transform: uppercase;
              letter-spacing: 0.16em;
            }
            p {
              margin: 0 0 22px;
              font-size: \${settings.fontSize}px;
              line-height: \${settings.lineHeight};
              white-space: pre-wrap;
              word-break: keep-all;
              overflow-wrap: anywhere;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>\${title}</h1>
            <div class="meta">Reader Mode</div>
            \${bodyMarkup}
          </main>
        </body>
      \`;

      return true;
    })();
  `;
}

function setLoading(isLoading) {
  if (isLoading) {
    setStageNotice(DEFAULT_STAGE_NOTICE.eyebrow, DEFAULT_STAGE_NOTICE.title, DEFAULT_STAGE_NOTICE.body);
  }
  elements.stagePlaceholder?.classList.toggle("is-hidden", !isLoading);
}

function setStageNotice(eyebrow, title, body) {
  if (elements.stagePlaceholderEyebrow) {
    elements.stagePlaceholderEyebrow.textContent = eyebrow;
  }
  if (elements.stagePlaceholderTitle) {
    elements.stagePlaceholderTitle.textContent = title;
  }
  if (elements.stagePlaceholderBody) {
    elements.stagePlaceholderBody.textContent = body;
  }
}

function setStatus(message) {
  if (elements.statusText) {
    elements.statusText.textContent = message;
  }
}

function createEmpty(message) {
  const node = document.createElement("div");
  node.className = "empty-note";
  node.textContent = message;
  return node;
}

function normalizeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    return "";
  }

  try {
    return new URL(value).toString();
  } catch {
    try {
      return new URL(`https://${value}`).toString();
    } catch {
      return "";
    }
  }
}

function getInitialUrl() {
  const storedUrl = localStorage.getItem(STORAGE_KEYS.currentUrl);
  const normalizedStoredUrl = normalizeUrl(storedUrl);
  if (normalizedStoredUrl && /^https?:/i.test(normalizedStoredUrl) && !normalizedStoredUrl.startsWith("chrome-error://")) {
    if (normalizedStoredUrl.includes("m.joara.com")) {
      return getPresetHomeUrl(SITE_PRESETS.find((site) => site.id === "joara"));
    }

    return normalizedStoredUrl;
  }

  return getPresetHomeUrl(SITE_PRESETS[0]);
}

function simplifyHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isReadingUrl(url) {
  const value = String(url || "").toLowerCase();
  if (!value) {
    return false;
  }

  if (value.includes("munpia.com")) {
    return [
      "/novel/",
      "viewer",
      "read",
      "episode",
      "chapter",
      "menu=novel",
      "?num=",
      "&num="
    ].some((token) => value.includes(token));
  }

  if (value.includes("joara.com")) {
    return [
      "book",
      "viewer",
      "read",
      "episode",
      "chapter",
      "story"
    ].some((token) => value.includes(token));
  }

  return false;
}

function buildReaderChromeSuppressionCss(url) {
  if (!isReadingUrl(url)) {
    return "";
  }

  const value = String(url || "").toLowerCase();

  if (value.includes("munpia.com")) {
    return `
      header,
      footer,
      nav,
      aside,
      [class*='toolbar'],
      [id*='toolbar'],
      [class*='viewer_top'],
      [id*='viewer_top'],
      [class*='viewer-header'],
      [id*='viewer-header'],
      [class*='topbar'],
      [id*='topbar'],
      [class*='episode_head'],
      [id*='episode_head'],
      [class*='episode-title'],
      [id*='episode-title'],
      [class*='chapter_head'],
      [id*='chapter_head'],
      [class*='chapter-title'],
      [id*='chapter-title'],
      [class*='novel_title'],
      [id*='novel_title'],
      [class*='title_box'],
      [id*='title_box'],
      [class*='read_option'],
      [id*='read_option'],
      [class*='view_option'],
      [id*='view_option'],
      button[aria-label*='설정'],
      button[title*='설정'],
      [title*='설정'],
      [aria-label*='설정'] {
        display: none !important;
        visibility: hidden !important;
        max-height: 0 !important;
        overflow: hidden !important;
      }
    `;
  }

  if (value.includes("joara.com")) {
    return `
      header,
      footer,
      nav,
      aside,
      [class*='toolbar'],
      [id*='toolbar'],
      [class*='viewer_top'],
      [id*='viewer_top'],
      [class*='viewer-header'],
      [id*='viewer-header'],
      [class*='topbar'],
      [id*='topbar'],
      [class*='title_box'],
      [id*='title_box'],
      [class*='read_option'],
      [id*='read_option'],
      [class*='view_option'],
      [id*='view_option'] {
        display: none !important;
        visibility: hidden !important;
        max-height: 0 !important;
        overflow: hidden !important;
      }
    `;
  }

  return "";
}

function buildReaderComfortCss(url) {
  if (!isReadingUrl(url)) {
    return "";
  }

  return `
    html, body {
      scroll-behavior: smooth !important;
    }

    body {
      padding-bottom: 24px !important;
    }

    #novel_content,
    #novelContent,
    #revContents,
    .novel_view_area,
    .novel_view,
    .viewer_contents,
    .viewer_body,
    .episode-content,
    .ep-content,
    .read_area,
    .view_content,
    .content_view,
    [class*='viewer_contents'],
    [class*='viewer_body'],
    [class*='episode-content'],
    [class*='read_area'],
    [class*='view_content'],
    article,
    main {
      max-width: 760px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 18px !important;
      padding-right: 18px !important;
      background-color: #f6efb6 !important;
    }

    #novel_content p,
    #novelContent p,
    #revContents p,
    .novel_view_area p,
    .novel_view p,
    .viewer_contents p,
    .viewer_body p,
    .episode-content p,
    .ep-content p,
    .read_area p,
    .view_content p,
    .content_view p,
    [class*='viewer_contents'] p,
    [class*='viewer_body'] p,
    [class*='episode-content'] p,
    [class*='read_area'] p,
    [class*='view_content'] p,
    article p,
    main p {
      line-height: 1.92 !important;
      letter-spacing: 0.01em !important;
      color: #231f15 !important;
    }
  `;
}

function buildPopupCloseVisibilityCss() {
  return `
    button[class*='close' i],
    a[class*='close' i],
    [role='button'][class*='close' i],
    button[id*='close' i],
    a[id*='close' i],
    [role='button'][id*='close' i],
    button[aria-label*='close' i],
    a[aria-label*='close' i],
    button[title*='close' i],
    a[title*='close' i],
    button[aria-label*='닫기'],
    a[aria-label*='닫기'],
    button[title*='닫기'],
    a[title*='닫기'],
    [class*='popup' i] button[class*='btn' i][class*='close' i],
    [class*='modal' i] button[class*='btn' i][class*='close' i] {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      visibility: visible !important;
      opacity: 1 !important;
      color: #231f15 !important;
      z-index: 2147483647 !important;
      pointer-events: auto !important;
    }

    button[class*='close' i] img,
    a[class*='close' i] img,
    [role='button'][class*='close' i] img,
    button[id*='close' i] img,
    a[id*='close' i] img,
    [role='button'][id*='close' i] img,
    button[class*='close' i] svg,
    a[class*='close' i] svg,
    [role='button'][class*='close' i] svg,
    button[id*='close' i] svg,
    a[id*='close' i] svg,
    [role='button'][id*='close' i] svg,
    button[class*='close' i] i,
    a[class*='close' i] i,
    [role='button'][class*='close' i] i,
    button[id*='close' i] i,
    a[id*='close' i] i,
    [role='button'][id*='close' i] i,
    button[aria-label*='닫기'] img,
    a[aria-label*='닫기'] img,
    button[aria-label*='닫기'] svg,
    a[aria-label*='닫기'] svg,
    button[title*='닫기'] img,
    a[title*='닫기'] img,
    button[title*='닫기'] svg,
    a[title*='닫기'] svg {
      display: inline-block !important;
      visibility: visible !important;
      opacity: 1 !important;
      color: #231f15 !important;
      fill: currentColor !important;
    }
  `;
}

function isAuthPage(url) {
  const value = String(url || "").toLowerCase();
  return [
    "login",
    "signin",
    "sign-in",
    "auth",
    "oauth",
    "account",
    "kakao"
  ].some((token) => value.includes(token));
}

function shouldUseMinimalAmbientTheme(url) {
  const value = String(url || "").toLowerCase();
  return [
    "munpia.com",
    "joara.com"
  ].some((token) => value.includes(token));
}

function loadJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function persistJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function persistScalar(key, value) {
  localStorage.setItem(key, value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
