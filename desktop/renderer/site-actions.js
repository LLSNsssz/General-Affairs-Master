"use strict";
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
    const codeMatch = /^Digit([1-4])$/.exec(String(event.code || ""));
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
    if (!readerController.canGoBack()) {
        setStatus("No previous page");
        return;
    }
    readerController.goBack();
}
