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
        return;
    }
    if (command.type === "open-previous-episode") {
        void runReaderActionShortcut("previous-episode");
        return;
    }
    if (command.type === "open-next-episode") {
        void runReaderActionShortcut("next-episode");
        return;
    }
    if (command.type === "open-episode-list") {
        void runReaderActionShortcut("episode-list");
        return;
    }
    if (command.type === "open-episode-comments") {
        void runReaderActionShortcut("episode-comments");
        return;
    }
    if (command.type === "open-site-recent") {
        void runReaderActionShortcut("site-recent");
        return;
    }
    if (command.type === "toggle-reader-devtools") {
        void toggleReaderDevTools();
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
function goBackInReaderHistory() {
    if (!readerController.canGoBack()) {
        setStatus("No previous page");
        return;
    }
    readerController.goBack();
}
function getCurrentReaderUrl() {
    return (readerController.getURL() || state.currentUrl || "").toLowerCase();
}
async function toggleReaderDevTools() {
    if (!readerController.isAttached() || !window.stickyDesktop?.toggleReaderDevTools) {
        setStatus("Reader DevTools is not available");
        return;
    }
    try {
        const opened = await window.stickyDesktop.toggleReaderDevTools();
        if (!opened) {
            setStatus("Reader DevTools closed");
            return;
        }
        const report = await readerController.executeJavaScript(buildReaderOverlayDebugScript(), true);
        const top = Array.isArray(report) ? report[0] : null;
        const topLabel = top?.selector || "no overlay candidate";
        setStatus(`Reader DevTools opened | top overlay: ${topLabel}`);
    }
    catch (error) {
        console.error(error);
        setStatus("Could not open Reader DevTools");
    }
}
async function dismissMunpiaOverlayIfPresent() {
    if (!readerController.isAttached()) {
        return false;
    }
    try {
        return Boolean(await readerController.executeJavaScript(buildMunpiaDismissOverlayScript(), true));
    }
    catch (error) {
        console.error(error);
        return false;
    }
}
function goBackCurrentPage() {
    goBackInReaderHistory();
}
function isNovelpiaReaderPage(url) {
    return url.includes("novelpia.com") && isReadingUrl(url);
}
function isMunpiaReaderPage(url) {
    return url.includes("munpia.com") && isReadingUrl(url);
}
function getReaderActionStatusLabel(action) {
    switch (action) {
        case "previous-episode":
            return "Opened previous episode";
        case "next-episode":
            return "Opened next episode";
        case "episode-list":
            return "Opened episode list";
        case "episode-comments":
            return "Opened comments";
        case "site-recent":
            return "Opened recent records";
    }
}
function getUnsupportedReaderActionMessage(action, url) {
    if (url.includes("novelpia.com")) {
        if (action === "previous-episode") {
            return "Previous episode is not available here";
        }
        return "This Novelpia page does not support that action";
    }
    if (url.includes("munpia.com")) {
        if (action === "episode-list") {
            return "Could not open the Munpia episode list";
        }
        return "This Munpia page does not support that action yet";
    }
    return "This page does not support that reader shortcut yet";
}
async function runReaderActionShortcut(action) {
    setHelpPopupOpen(false);
    if (!readerController.isAttached()) {
        setStatus("Reader is not attached");
        return;
    }
    const currentUrl = (readerController.getURL() || state.currentUrl || "").toLowerCase();
    let script = "";
    if (isNovelpiaReaderPage(currentUrl)) {
        script = buildNovelpiaReaderActionScript(action);
    }
    else if (isMunpiaReaderPage(currentUrl)) {
        script = buildMunpiaReaderActionScript(action);
    }
    if (!script) {
        setStatus(getUnsupportedReaderActionMessage(action, currentUrl));
        return;
    }
    try {
        const didRun = await readerController.executeJavaScript(script, true);
        setStatus(didRun ? getReaderActionStatusLabel(action) : getUnsupportedReaderActionMessage(action, currentUrl));
    }
    catch (error) {
        console.error(error);
        setStatus("Could not run the reader shortcut");
    }
}
function buildNovelpiaReaderActionScript(action) {
    return `
    (() => {
      const action = ${JSON.stringify(action)};

      function getMenuItem(label) {
        return Array.from(document.querySelectorAll(".menu-bottom-item")).find((node) => {
          return node instanceof HTMLElement && String(node.innerText || node.textContent || "").includes(label);
        }) || null;
      }

      function clickMenuItem(label) {
        const target = getMenuItem(label);
        if (!(target instanceof HTMLElement)) {
          return false;
        }

        target.click();
        return true;
      }

      if (action === "previous-episode") {
        const target = getMenuItem("이전화");
        if (!(target instanceof HTMLElement) || target.querySelector(".epi-menu-none")) {
          return false;
        }

        target.click();
        return true;
      }

      if (action === "next-episode") {
        const nextEpisode = document.getElementById("content_no_next");
        const nextContentNo = nextEpisode instanceof HTMLInputElement ? nextEpisode.value : "";
        if (nextContentNo && typeof window.check_next_episode_link === "function") {
          window.check_next_episode_link(nextContentNo);
          return true;
        }

        return clickMenuItem("다음화");
      }

      if (action === "episode-list") {
        if (typeof window.btn_list2 === "function") {
          window.btn_list2();
          return true;
        }

        return clickMenuItem("목록");
      }

      if (action === "episode-comments") {
        if (typeof window.btn_comment2 === "function") {
          window.btn_comment2();
          return true;
        }

        return clickMenuItem("댓글");
      }

      if (action === "site-recent") {
        const target = new URL("/mybook/last_view", window.location.href);
        window.location.href = target.toString();
        return true;
      }

      return false;
    })();
  `;
}
function buildMunpiaReaderActionScript(action) {
    if (action !== "episode-list") {
        return "";
    }
    return `
    (() => {
      function getEpisodeListUrl() {
        const current = new URL(window.location.href);
        const pathParts = current.pathname.split("/").filter(Boolean);
        if (pathParts[0] && /^\\d+$/.test(pathParts[0])) {
          return new URL("/" + pathParts[0], current.origin).toString();
        }

        const candidate = Array.from(document.querySelectorAll("a[href]")).find((node) => {
          if (!(node instanceof HTMLAnchorElement)) {
            return false;
          }

          const href = new URL(node.href, window.location.href);
          const hrefParts = href.pathname.split("/").filter(Boolean);
          if (!hrefParts[0] || !/^\\d+$/.test(hrefParts[0]) || hrefParts.length !== 1) {
            return false;
          }

          const text = String(node.innerText || node.textContent || node.getAttribute("title") || "").replace(/\\s+/g, " ").trim();
          return text.length > 0;
        });

        return candidate instanceof HTMLAnchorElement ? candidate.href : "";
      }

      const targetUrl = getEpisodeListUrl();
      if (!targetUrl) {
        return false;
      }

      window.location.href = targetUrl;
      return true;
    })();
  `;
}
function buildMunpiaDismissOverlayScript() {
    return `
    (() => {
      function isVisible(node) {
        if (!(node instanceof HTMLElement)) {
          return false;
        }

        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") <= 0) {
          return false;
        }

        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function isOverlayCandidate(node) {
        if (!(node instanceof HTMLElement) || !isVisible(node)) {
          return false;
        }

        if (node.closest("#sticky-munpia-reader-root, #sticky-munpia-back-chip, #sticky-munpia-next-chip, #sticky-munpia-list-chip")) {
          return false;
        }

        const descriptor = [
          node.id || "",
          node.className || "",
          node.getAttribute("role") || "",
          node.getAttribute("aria-modal") || ""
        ].join(" ").toLowerCase();
        const style = window.getComputedStyle(node);
        const toasterOverlay = node.id === "_rht_toaster" || descriptor.includes("_rht_toaster");
        const listOverlay = node.id === "list_box" || descriptor.includes("list_box");
        const modalRole = node.getAttribute("role") === "dialog" || node.getAttribute("aria-modal") === "true";
        const namedOverlay = /(modal|popup|dialog|overlay|backdrop|dim)/.test(descriptor);
        return toasterOverlay || listOverlay || modalRole || namedOverlay;
      }

      function hideNode(node) {
        if (!(node instanceof HTMLElement)) {
          return;
        }

        node.setAttribute("data-sticky-munpia-dismissed", "1");
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
        node.style.setProperty("pointer-events", "none", "important");
      }

      const closeSelector = [
        "button[class*='close' i]",
        "a[class*='close' i]",
        "[role='button'][class*='close' i]",
        "button[id*='close' i]",
        "a[id*='close' i]",
        "[role='button'][id*='close' i]",
        ".btn-close",
        ".close"
      ].join(", ");

      const candidates = Array.from(document.querySelectorAll([
        "#_rht_toaster",
        "#list_box",
        "[id*='list_box']",
        "[class*='list_box']",
        "[aria-modal='true']",
        "[role='dialog']",
        "[class*='modal']",
        "[id*='modal']",
        "[class*='popup']",
        "[id*='popup']",
        "[class*='overlay']",
        "[id*='overlay']",
        "[class*='backdrop']",
        "[id*='backdrop']",
        "[class*='dim']",
        "[id*='dim']"
      ].join(", "))).filter(isOverlayCandidate);

      let dismissed = false;
      candidates.sort((left, right) => {
        const leftZ = Number(window.getComputedStyle(left).zIndex || "0");
        const rightZ = Number(window.getComputedStyle(right).zIndex || "0");
        return rightZ - leftZ;
      });

      candidates.forEach((node) => {
        const closeButton = node.matches(closeSelector)
          ? node
          : node.querySelector(closeSelector);

        if (closeButton instanceof HTMLElement) {
          closeButton.click();
          dismissed = true;
        }

        if (isVisible(node)) {
          hideNode(node);
          dismissed = true;
        }
      });

      if (dismissed) {
        document.body?.removeAttribute("data-sticky-munpia-native-overlay");
        document.body?.style.removeProperty("overflow");
        document.documentElement?.style.removeProperty("overflow");
      }

      return dismissed;
    })();
  `;
}
function buildReaderOverlayDebugScript() {
    return `
    (() => {
      function isVisible(node) {
        if (!(node instanceof HTMLElement)) {
          return false;
        }

        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") <= 0) {
          return false;
        }

        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function buildSelector(node) {
        if (!(node instanceof HTMLElement)) {
          return "";
        }

        const parts = [node.tagName.toLowerCase()];
        if (node.id) {
          parts.push("#" + node.id);
        }

        const classList = Array.from(node.classList || []).slice(0, 3);
        if (classList.length) {
          parts.push("." + classList.join("."));
        }

        return parts.join("");
      }

      function summarizeText(node) {
        if (!(node instanceof HTMLElement)) {
          return "";
        }

        return String(node.innerText || node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80);
      }

      function isOverlayCandidate(node) {
        if (!(node instanceof HTMLElement) || !isVisible(node)) {
          return false;
        }

        const style = window.getComputedStyle(node);
        const descriptor = [
          node.id || "",
          node.className || "",
          node.getAttribute("role") || "",
          node.getAttribute("aria-modal") || ""
        ].join(" ").toLowerCase();
        const rect = node.getBoundingClientRect();
        const overlayPosition = style.position === "fixed" || style.position === "absolute" || style.position === "sticky";
        const zIndex = Number(style.zIndex || "0");
        const toasterOverlay = node.id === "_rht_toaster" || descriptor.includes("_rht_toaster");
        return (
          toasterOverlay
          || /(modal|popup|dialog|overlay|backdrop|dim|list_box)/.test(descriptor)
          || node.getAttribute("role") === "dialog"
          || node.getAttribute("aria-modal") === "true"
          || (overlayPosition && zIndex >= 5)
          || (overlayPosition && rect.width >= window.innerWidth * 0.3 && rect.height >= 60)
        );
      }

      const candidates = Array.from(document.querySelectorAll("body *"))
        .filter(isOverlayCandidate)
        .map((node) => {
          const element = node;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            selector: buildSelector(element),
            role: element.getAttribute("role") || "",
            position: style.position,
            zIndex: style.zIndex || "",
            pointerEvents: style.pointerEvents,
            opacity: style.opacity,
            rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)].join(","),
            text: summarizeText(element)
          };
        })
        .sort((left, right) => {
          const rightZ = Number(right.zIndex || "0");
          const leftZ = Number(left.zIndex || "0");
          if (rightZ !== leftZ) {
            return rightZ - leftZ;
          }

          const [leftWidth, leftHeight] = left.rect.split(",").slice(2).map((value) => Number(value) || 0);
          const [rightWidth, rightHeight] = right.rect.split(",").slice(2).map((value) => Number(value) || 0);
          return rightWidth * rightHeight - leftWidth * leftHeight;
        })
        .slice(0, 20);

      const hitPoints = [
        ["top-center", Math.round(window.innerWidth / 2), Math.min(Math.round(window.innerHeight * 0.2), Math.max(80, window.innerHeight - 1))],
        ["center", Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2)]
      ].map(([label, x, y]) => ({
        point: label,
        x,
        y,
        stack: document.elementsFromPoint(x, y).slice(0, 8).map(buildSelector).join(" > ")
      }));

      console.group("[Sticky Debug] Overlay candidates");
      console.table(candidates);
      console.table(hitPoints);
      console.groupEnd();
      return candidates;
    })();
  `;
}
