"use strict";
// Incremental TypeScript migration source-of-truth for the renderer entry.
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
    novelpiaTypography: "sticky.desktop.novelpiaTypography",
    currentUrl: "sticky.desktop.currentUrl",
    simplifyEnabled: "sticky.desktop.simplifyEnabled"
};
const DEFAULT_STAGE_NOTICE = {
    eyebrow: "",
    title: "Loading",
    body: ""
};
const state = {
    bookmarks: mergePresetBookmarks(loadJson(STORAGE_KEYS.bookmarks, DEFAULT_BOOKMARKS)),
    recentPages: loadJson(STORAGE_KEYS.recentPages, []),
    settings: loadJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
    novelpiaTypography: loadJson(STORAGE_KEYS.novelpiaTypography, null),
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
    currentX: 0,
    currentY: 0,
    moved: false
};
document.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("error", handleGlobalError);
window.addEventListener("unhandledrejection", handleUnhandledRejection);
function initialize() {
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
function queryElement(selector) {
    return document.querySelector(selector);
}
function cacheElements() {
    elements.bookmarkList = queryElement("#bookmark-list");
    elements.bookmarkForm = queryElement("#bookmark-form");
    elements.bookmarkName = queryElement("#bookmark-name");
    elements.bookmarkUrl = queryElement("#bookmark-url");
    elements.recentList = queryElement("#recent-list");
    elements.addressForm = queryElement("#address-form");
    elements.addressInput = queryElement("#address-input");
    elements.browserStage = queryElement(".browser-stage");
    elements.titleHitArea = queryElement("#title-hit-area");
    elements.toggleHelpButton = queryElement("#toggle-help");
    elements.helpPopup = queryElement("#help-popup");
    elements.closeHelpButton = queryElement("#close-help");
    elements.siteHelpList = queryElement("#site-help-list");
    elements.closeWindowButton = queryElement("#close-window");
    elements.minimizeWindowButton = queryElement("#minimize-window");
    elements.maximizeWindowButton = queryElement("#maximize-window");
    elements.backButton = queryElement("#go-back");
    elements.forwardButton = queryElement("#go-forward");
    elements.reloadButton = queryElement("#reload-page");
    elements.toggleSimplifyButton = queryElement("#toggle-simplify");
    elements.toggleBookmarksButton = queryElement("#toggle-bookmarks");
    elements.toggleHistoryButton = queryElement("#toggle-history");
    elements.toggleSettingsButton = queryElement("#toggle-settings");
    elements.statusText = queryElement("#status-text");
    elements.pageTitle = queryElement("#page-title");
    elements.stagePlaceholder = queryElement("#stage-placeholder");
    elements.stageCover = queryElement("#stage-cover");
    elements.stagePlaceholderEyebrow = queryElement("#stage-placeholder .eyebrow");
    elements.stagePlaceholderTitle = queryElement("#stage-placeholder h2");
    elements.stagePlaceholderBody = queryElement("#stage-placeholder .muted");
    elements.readerStageHost = queryElement("#reader-stage-host");
    elements.siteSwitchToast = queryElement("#site-switch-toast");
    elements.bookmarkDrawer = queryElement("#bookmark-drawer");
    elements.recentDrawer = queryElement("#recent-drawer");
    elements.settingsDrawer = queryElement("#settings-drawer");
    elements.fontSize = queryElement("#font-size");
    elements.fontSizeValue = queryElement("#font-size-value");
    elements.lineHeight = queryElement("#line-height");
    elements.lineHeightValue = queryElement("#line-height-value");
}
function bindEvents() {
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
            state.simplifyEnabled = false;
            persistScalar(STORAGE_KEYS.simplifyEnabled, "false");
            updateSimplifyButton();
            readerController.reload();
        });
    }
    if (elements.toggleSimplifyButton) {
        elements.toggleSimplifyButton.addEventListener("click", async () => {
            if (state.simplifyEnabled) {
                state.simplifyEnabled = false;
                persistScalar(STORAGE_KEYS.simplifyEnabled, "false");
                updateSimplifyButton();
                readerController.reload();
                setStatus("Returned to the original page");
                return;
            }
            await applySimplifyMode();
        });
    }
    if (elements.fontSize) {
        const fontSize = elements.fontSize;
        elements.fontSize.addEventListener("input", async () => {
            state.settings.fontSize = Number(fontSize.value);
            applySettings();
            persistJson(STORAGE_KEYS.settings, state.settings);
            if (state.simplifyEnabled) {
                await applySimplifyMode();
            }
        });
    }
    if (elements.lineHeight) {
        const lineHeight = elements.lineHeight;
        elements.lineHeight.addEventListener("input", async () => {
            state.settings.lineHeight = Number(lineHeight.value);
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
function setLoading(isLoading) {
    if (isLoading) {
        setStageNotice(DEFAULT_STAGE_NOTICE.eyebrow, DEFAULT_STAGE_NOTICE.title, DEFAULT_STAGE_NOTICE.body);
    }
    document.body.classList.toggle("is-loading", isLoading);
    elements.stageCover?.classList.toggle("is-hidden", !isLoading);
    elements.stagePlaceholder?.classList.toggle("is-hidden", !isLoading);
}
function setStageNotice(eyebrow, title, body) {
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
function setStatus(message) {
    if (elements.statusText) {
        elements.statusText.textContent = message;
    }
}
