function renderBookmarks(): void {
  if (!elements.bookmarkList) {
    return;
  }

  const bookmarkList = elements.bookmarkList;
  bookmarkList.replaceChildren();

  if (state.bookmarks.length === 0) {
    bookmarkList.append(createEmpty("No bookmarks yet"));
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
    bookmarkList.append(button);
  });
}

function renderRecentPages(): void {
  if (!elements.recentList) {
    return;
  }

  const recentList = elements.recentList;
  recentList.replaceChildren();

  if (state.recentPages.length === 0) {
    recentList.append(createEmpty("No history yet"));
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
    recentList.append(button);
  });
}

function applySettings(): void {
  state.settings = normalizeRendererSettings(state.settings);

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
  if (elements.letterSpacing) {
    elements.letterSpacing.value = String(state.settings.letterSpacing);
  }
  if (elements.letterSpacingValue) {
    elements.letterSpacingValue.value = formatLetterSpacingEm(state.settings.letterSpacing);
  }
  if (elements.fontFamilyPreset) {
    elements.fontFamilyPreset.value = state.settings.fontFamilyPreset;
  }
}

function updateSimplifyButton(): void {
  if (!elements.toggleSimplifyButton) {
    return;
  }

  elements.toggleSimplifyButton.classList.toggle("is-active", state.simplifyEnabled);
  elements.toggleSimplifyButton.textContent = state.simplifyEnabled ? "MEMO" : "WEB";
  elements.toggleSimplifyButton.title = state.simplifyEnabled ? "Memo mode on" : "Web mode on";
  elements.toggleSimplifyButton.setAttribute("aria-label", state.simplifyEnabled ? "Switch to web mode" : "Switch to memo mode");
}

function isHelpPopupOpen(): boolean {
  return Boolean(elements.helpPopup && !elements.helpPopup.classList.contains("is-hidden"));
}

function isSettingsPopupOpen(): boolean {
  return Boolean(elements.settingsPopup && !elements.settingsPopup.classList.contains("is-hidden"));
}

function toggleDrawer(drawerName: RendererDrawerName): void {
  setHelpPopupOpen(false);
  setSettingsPopupOpen(false);
  activeDrawer = activeDrawer === drawerName ? "" : drawerName;
  renderDrawers();
}

function closeDrawers(): void {
  if (!activeDrawer) {
    return;
  }

  activeDrawer = "";
  renderDrawers();
}

function closeTransientPanels(): void {
  closeDrawers();
  setHelpPopupOpen(false);
  setSettingsPopupOpen(false);
}

function setHelpPopupOpen(isOpen: boolean): void {
  if (!elements.helpPopup) {
    return;
  }

  document.body.classList.toggle("is-help-open", isOpen);
  elements.helpPopup.classList.toggle("is-hidden", !isOpen);
  elements.helpPopup.classList.toggle("is-open", isOpen);
  elements.toggleHelpButton?.classList.toggle("is-active", isOpen);

  if (isOpen) {
    if (isSettingsPopupOpen()) {
      setSettingsPopupOpen(false);
    }
    closeDrawers();
    renderHelpSiteList();
  }

  syncReaderBounds();
}

function setSettingsPopupOpen(isOpen: boolean): void {
  if (!elements.settingsPopup) {
    return;
  }

  document.body.classList.toggle("is-settings-open", isOpen);
  elements.settingsPopup.classList.toggle("is-hidden", !isOpen);
  elements.settingsPopup.classList.toggle("is-open", isOpen);
  elements.toggleSettingsButton?.classList.toggle("is-active", isOpen);

  if (isOpen) {
    if (isHelpPopupOpen()) {
      setHelpPopupOpen(false);
    }
    closeDrawers();
  }

  syncReaderBounds();
}

function renderDrawers(): void {
  elements.bookmarkDrawer?.classList.toggle("is-open", activeDrawer === "bookmarks");
  elements.recentDrawer?.classList.toggle("is-open", activeDrawer === "history");

  elements.toggleBookmarksButton?.classList.toggle("is-active", activeDrawer === "bookmarks");
  elements.toggleHistoryButton?.classList.toggle("is-active", activeDrawer === "history");
  syncReaderBounds();
}

function renderHelpSiteList(): void {
  if (!elements.siteHelpList) {
    return;
  }

  const siteHelpList = elements.siteHelpList;
  const currentIndex = findPresetIndexByUrl(state.currentUrl);
  siteHelpList.replaceChildren();

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
    siteHelpList.append(row);
  });
}

function renderWindowState(): void {
  document.body.classList.toggle("is-collapsed", Boolean(state.windowMeta.collapsed));
  document.body.classList.toggle("is-pinned", Boolean(state.windowMeta.alwaysOnTop));
}

function applyWindowState(nextState?: { collapsed: boolean; alwaysOnTop: boolean } | null): void {
  if (!nextState) {
    return;
  }

  state.windowMeta = {
    collapsed: Boolean(nextState.collapsed),
    alwaysOnTop: Boolean(nextState.alwaysOnTop)
  };
  renderWindowState();
  syncReaderBounds();
}

async function hydrateWindowState(): Promise<void> {
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
