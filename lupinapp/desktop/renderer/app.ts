// Incremental TypeScript migration source-of-truth for the renderer entry.

const DEFAULT_BOOKMARKS = SITE_PRESETS.map((site) => ({
  id: site.id,
  name: site.name,
  url: getPresetHomeUrl(site),
  meta: getPresetMeta(site)
}));

const DEFAULT_SETTINGS = DEFAULT_RENDERER_SETTINGS;

const STORAGE_KEYS = {
  bookmarks: "sticky.desktop.bookmarks",
  recentPages: "sticky.desktop.recentPages",
  settings: "sticky.desktop.settings",
  novelpiaTypography: "sticky.desktop.novelpiaTypography",
  currentUrl: "sticky.desktop.currentUrl",
  simplifyEnabled: "sticky.desktop.simplifyEnabled"
};

const DEFAULT_STAGE_NOTICE = {
  eyebrow: "",
  title: "Loading",
  body: ""
};

const state: RendererState = {
  bookmarks: mergePresetBookmarks(loadJson(STORAGE_KEYS.bookmarks, DEFAULT_BOOKMARKS)),
  recentPages: loadJson<RendererRecentPageRecord[]>(STORAGE_KEYS.recentPages, []),
  settings: normalizeRendererSettings(loadJson<Partial<RendererSettings>>(STORAGE_KEYS.settings, DEFAULT_SETTINGS)),
  novelpiaTypography: loadJson<RendererTypographyPreset | null>(STORAGE_KEYS.novelpiaTypography, null),
  currentUrl: getInitialUrl(),
  simplifyEnabled: localStorage.getItem(STORAGE_KEYS.simplifyEnabled) === "true",
  ambientThemeKey: "",
  windowMeta: {
    collapsed: false,
    alwaysOnTop: false
  }
};

const elements: RendererElements = {};
let activeDrawer: RendererDrawerName = "";
let siteSwitchToastTimer = 0;
let loadingFallbackTimer = 0;
const windowDrag: {
  active: boolean;
  pointerId: number | null;
  requestId: number;
  originX: number;
  originY: number;
  startScreenX: number;
  startScreenY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
} = {
  active: false,
  pointerId: null,
  requestId: 0,
  originX: 0,
  originY: 0,
  startScreenX: 0,
  startScreenY: 0,
  currentX: 0,
  currentY: 0,
  moved: false
};

document.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("error", handleGlobalError);
window.addEventListener("unhandledrejection", handleUnhandledRejection);

function shouldAdoptStoredNovelpiaTypography(): boolean {
  const settings = normalizeRendererSettings(state.settings);
  return Boolean(
    state.novelpiaTypography
    && !settings.initializedFromNovelpia
    && settings.fontSize === DEFAULT_RENDERER_SETTINGS.fontSize
    && settings.lineHeight === DEFAULT_RENDERER_SETTINGS.lineHeight
    && settings.letterSpacing === DEFAULT_RENDERER_SETTINGS.letterSpacing
    && settings.fontFamilyPreset === DEFAULT_RENDERER_SETTINGS.fontFamilyPreset
  );
}

function adoptStoredNovelpiaTypography(): void {
  if (!shouldAdoptStoredNovelpiaTypography() || !state.novelpiaTypography) {
    return;
  }

  state.settings.fontSize = Number(state.novelpiaTypography.fontSize.toFixed(0));
  state.settings.lineHeight = Number(state.novelpiaTypography.lineHeight.toFixed(2));
  state.settings.letterSpacing = parseLetterSpacingValue(state.novelpiaTypography.letterSpacing, state.novelpiaTypography.fontSize);
  state.settings.fontFamilyPreset = "site";
  state.settings.initializedFromNovelpia = true;
  state.settings = normalizeRendererSettings(state.settings);
  persistJson(STORAGE_KEYS.settings, state.settings);
}

function initialize(): void {
  adoptStoredNovelpiaTypography();
  cacheElements();
  startReaderController();
  bindEvents();
  applySettings();
  renderBookmarks();
  renderRecentPages();
  renderHelpSiteList();
  renderState();
  attachReaderEvents();
  hydrateWindowState();
  hydrateShortcutCommands();
  queueInitialNavigation();
}

function queryElement<T extends Element>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

function cacheElements(): void {
  elements.bookmarkList = queryElement<HTMLElement>("#bookmark-list");
  elements.bookmarkForm = queryElement<HTMLFormElement>("#bookmark-form");
  elements.bookmarkName = queryElement<HTMLInputElement>("#bookmark-name");
  elements.bookmarkUrl = queryElement<HTMLInputElement>("#bookmark-url");
  elements.recentList = queryElement<HTMLElement>("#recent-list");
  elements.addressForm = queryElement<HTMLFormElement>("#address-form");
  elements.addressInput = queryElement<HTMLInputElement>("#address-input");
  elements.browserStage = queryElement<HTMLElement>(".browser-stage");
  elements.titleHitArea = queryElement<HTMLElement>("#title-hit-area");
  elements.toggleHelpButton = queryElement<HTMLButtonElement>("#toggle-help");
  elements.helpPopup = queryElement<HTMLElement>("#help-popup");
  elements.closeHelpButton = queryElement<HTMLButtonElement>("#close-help");
  elements.settingsPopup = queryElement<HTMLElement>("#settings-popup");
  elements.closeSettingsButton = queryElement<HTMLButtonElement>("#close-settings");
  elements.siteHelpList = queryElement<HTMLElement>("#site-help-list");
  elements.closeWindowButton = queryElement<HTMLButtonElement>("#close-window");
  elements.minimizeWindowButton = queryElement<HTMLButtonElement>("#minimize-window");
  elements.maximizeWindowButton = queryElement<HTMLButtonElement>("#maximize-window");
  elements.backButton = queryElement<HTMLButtonElement>("#go-back");
  elements.forwardButton = queryElement<HTMLButtonElement>("#go-forward");
  elements.reloadButton = queryElement<HTMLButtonElement>("#reload-page");
  elements.toggleSimplifyButton = queryElement<HTMLButtonElement>("#toggle-simplify");
  elements.toggleBookmarksButton = queryElement<HTMLButtonElement>("#toggle-bookmarks");
  elements.toggleHistoryButton = queryElement<HTMLButtonElement>("#toggle-history");
  elements.toggleSettingsButton = queryElement<HTMLButtonElement>("#toggle-settings");
  elements.statusText = queryElement<HTMLElement>("#status-text");
  elements.pageTitle = queryElement<HTMLElement>("#page-title");
  elements.stagePlaceholder = queryElement<HTMLElement>("#stage-placeholder");
  elements.stageCover = queryElement<HTMLElement>("#stage-cover");
  elements.stagePlaceholderEyebrow = queryElement<HTMLElement>("#stage-placeholder .eyebrow");
  elements.stagePlaceholderTitle = queryElement<HTMLElement>("#stage-placeholder h2");
  elements.stagePlaceholderBody = queryElement<HTMLElement>("#stage-placeholder .muted");
  elements.readerStageHost = queryElement<HTMLElement>("#reader-stage-host");
  elements.siteSwitchToast = queryElement<HTMLElement>("#site-switch-toast");
  elements.bookmarkDrawer = queryElement<HTMLElement>("#bookmark-drawer");
  elements.recentDrawer = queryElement<HTMLElement>("#recent-drawer");
  elements.fontSize = queryElement<HTMLInputElement>("#font-size");
  elements.fontSizeValue = queryElement<HTMLOutputElement>("#font-size-value");
  elements.lineHeight = queryElement<HTMLInputElement>("#line-height");
  elements.lineHeightValue = queryElement<HTMLOutputElement>("#line-height-value");
  elements.letterSpacing = queryElement<HTMLInputElement>("#letter-spacing");
  elements.letterSpacingValue = queryElement<HTMLOutputElement>("#letter-spacing-value");
  elements.fontFamilyPreset = queryElement<HTMLSelectElement>("#font-family-preset");
}

async function persistSettingsAndRefresh(): Promise<void> {
  state.settings = normalizeRendererSettings(state.settings);
  applySettings();
  persistJson(STORAGE_KEYS.settings, state.settings);

  if (state.simplifyEnabled) {
    await applySimplifyMode();
    return;
  }

  if (!readerController.isAttached()) {
    return;
  }

  await applyAmbientPageTheme();
  await applySiteDomAdapter();
}

async function setMemoModeEnabled(isEnabled: boolean): Promise<void> {
  if (state.simplifyEnabled === isEnabled) {
    updateSimplifyButton();
    return;
  }

  state.simplifyEnabled = isEnabled;
  persistScalar(STORAGE_KEYS.simplifyEnabled, isEnabled ? "true" : "false");
  updateSimplifyButton();

  if (!readerController.isAttached()) {
    return;
  }

  if (!isEnabled) {
    setStatus("Switching to web mode");
    readerController.reload();
    return;
  }

  await applySimplifyMode();
}

async function toggleMemoMode(): Promise<void> {
  await setMemoModeEnabled(!state.simplifyEnabled);
}

function bindEvents(): void {
  if (elements.bookmarkForm) {
    const bookmarkForm = elements.bookmarkForm;
    const bookmarkName = elements.bookmarkName;
    const bookmarkUrl = elements.bookmarkUrl;
    elements.bookmarkForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addBookmark(bookmarkName?.value || "", bookmarkUrl?.value || "");
      bookmarkForm.reset();
    });
  }

  if (elements.addressForm && elements.addressInput) {
    const addressInput = elements.addressInput;
    elements.addressForm.addEventListener("submit", (event) => {
      event.preventDefault();
      navigateTo(addressInput.value);
    });
  }

  if (elements.toggleBookmarksButton) {
    elements.toggleBookmarksButton.addEventListener("click", () => toggleDrawer("bookmarks"));
  }

  if (elements.toggleHistoryButton) {
    elements.toggleHistoryButton.addEventListener("click", () => toggleDrawer("history"));
  }

  if (elements.toggleSettingsButton) {
    elements.toggleSettingsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      setSettingsPopupOpen(!elements.settingsPopup?.classList.contains("is-open"));
    });
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

  if (elements.closeSettingsButton) {
    elements.closeSettingsButton.addEventListener("click", () => {
      setSettingsPopupOpen(false);
    });
  }

  if (elements.titleHitArea) {
    elements.titleHitArea.addEventListener("pointerdown", startWindowDrag);
    elements.titleHitArea.addEventListener("dblclick", async () => {
      stopWindowDrag();
      closeTransientPanels();
      const nextState = await window.stickyDesktop?.toggleCollapsedWindow();
      applyWindowState(nextState);
    });

    elements.titleHitArea.addEventListener("contextmenu", async (event) => {
      stopWindowDrag();
      event.preventDefault();
      closeTransientPanels();
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
      readerController.goBack();
    });
  }

  if (elements.forwardButton) {
    elements.forwardButton.addEventListener("click", () => {
      readerController.goForward();
    });
  }

  if (elements.reloadButton) {
    elements.reloadButton.addEventListener("click", () => {
      readerController.reload();
    });
  }

  if (elements.toggleSimplifyButton) {
    elements.toggleSimplifyButton.addEventListener("click", () => {
      void toggleMemoMode();
    });
  }

  if (elements.fontSize) {
    const fontSize = elements.fontSize;
    elements.fontSize.addEventListener("input", async () => {
      state.settings.fontSize = Number(fontSize.value);
      state.settings.initializedFromNovelpia = true;
      await persistSettingsAndRefresh();
    });
  }

  if (elements.lineHeight) {
    const lineHeight = elements.lineHeight;
    elements.lineHeight.addEventListener("input", async () => {
      state.settings.lineHeight = Number(lineHeight.value);
      state.settings.initializedFromNovelpia = true;
      await persistSettingsAndRefresh();
    });
  }

  if (elements.letterSpacing) {
    const letterSpacing = elements.letterSpacing;
    elements.letterSpacing.addEventListener("input", async () => {
      state.settings.letterSpacing = Number(letterSpacing.value);
      state.settings.initializedFromNovelpia = true;
      await persistSettingsAndRefresh();
    });
  }

  if (elements.fontFamilyPreset) {
    const fontFamilyPreset = elements.fontFamilyPreset;
    elements.fontFamilyPreset.addEventListener("change", async () => {
      state.settings.fontFamilyPreset = (fontFamilyPreset.value as RendererFontFamilyPreset) || "site";
      state.settings.initializedFromNovelpia = true;
      await persistSettingsAndRefresh();
    });
  }

  if (elements.browserStage) {
    elements.browserStage.addEventListener("click", () => {
      closeTransientPanels();
    });
  }

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const clickedHelpSurface = Boolean(
      elements.helpPopup
      && !elements.helpPopup.classList.contains("is-hidden")
      && (elements.helpPopup.contains(target) || elements.toggleHelpButton?.contains(target))
    );
    const clickedSettingsSurface = Boolean(
      elements.settingsPopup
      && !elements.settingsPopup.classList.contains("is-hidden")
      && (elements.settingsPopup.contains(target) || elements.toggleSettingsButton?.contains(target))
    );

    if (clickedHelpSurface || clickedSettingsSurface) {
      return;
    }

    setSettingsPopupOpen(false);
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
      setSettingsPopupOpen(!elements.settingsPopup?.classList.contains("is-open"));
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      void toggleMemoMode();
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      readerController.reload();
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
      if (readerController.canGoForward()) {
        readerController.goForward();
      }
      return;
    }

    if (event.key === "Escape") {
      if (elements.settingsPopup && !elements.settingsPopup.classList.contains("is-hidden")) {
        setSettingsPopupOpen(false);
        return;
      }
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
  window.addEventListener("blur", () => stopWindowDrag());
}

function handleGlobalError(event: ErrorEvent): void {
  const message = event?.error?.message || event?.message || "Renderer error";
  console.error(event?.error || message);
  setLoading(true);
  setStageNotice("Error", "Renderer problem", message);
  setStatus(`Error: ${message}`);
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event?.reason;
  const message = reason?.message || String(reason || "Unhandled rejection");
  console.error(reason);
  setLoading(true);
  setStageNotice("Error", "Async problem", message);
  setStatus(`Error: ${message}`);
}

function hydrateShortcutCommands(): void {
  if (window.stickyDesktop?.onShortcutCommand) {
    window.stickyDesktop.onShortcutCommand((command: Parameters<typeof handleShortcutCommand>[0]) => {
      handleShortcutCommand(command);
    });
  }
}

function renderState(): void {
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

function setLoading(isLoading: boolean): void {
  if (isLoading) {
    setStageNotice(DEFAULT_STAGE_NOTICE.eyebrow, DEFAULT_STAGE_NOTICE.title, DEFAULT_STAGE_NOTICE.body);
  }
  document.body.classList.toggle("is-loading", isLoading);
  elements.stageCover?.classList.toggle("is-hidden", !isLoading);
  elements.stagePlaceholder?.classList.toggle("is-hidden", !isLoading);
}

function setStageNotice(eyebrow: string, title: string, body: string): void {
  if (elements.stagePlaceholderEyebrow) {
    elements.stagePlaceholderEyebrow.textContent = eyebrow;
    elements.stagePlaceholderEyebrow.classList.toggle("is-hidden", !eyebrow);
  }
  if (elements.stagePlaceholderTitle) {
    elements.stagePlaceholderTitle.textContent = title;
  }
  if (elements.stagePlaceholderBody) {
    elements.stagePlaceholderBody.textContent = body;
    elements.stagePlaceholderBody.classList.toggle("is-hidden", !body);
  }
}

function setStatus(message: string): void {
  if (elements.statusText) {
    elements.statusText.textContent = message;
  }
}

