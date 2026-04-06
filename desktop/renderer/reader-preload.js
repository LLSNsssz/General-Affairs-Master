"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const STICKY_READER_BASE_STYLE_ID = "sticky-reader-base-style";
const STICKY_READER_SITE_STYLE_ID = "sticky-reader-site-style";
const STICKY_READER_MASK_ID = "sticky-reader-mask";
const STICKY_READER_READY_ATTR = "data-sticky-reader-ready";
const STICKY_READER_BASE_THEME = `
  :root {
    color-scheme: light !important;
    --sticky-paper: #f6efb6;
    --sticky-ink: #231f15;
  }

  html,
  body {
    background: var(--sticky-paper) !important;
    background-color: var(--sticky-paper) !important;
    background-image: none !important;
    color: var(--sticky-ink) !important;
    scrollbar-width: none !important;
  }

  body,
  body::before,
  body::after,
  [style*="background-image"] {
    background-image: none !important;
  }

  *::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
    display: none !important;
  }

  #${STICKY_READER_MASK_ID} {
    position: fixed !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    background: var(--sticky-paper) !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: none !important;
    transition: opacity 80ms linear, visibility 80ms linear !important;
  }

  html[${STICKY_READER_READY_ATTR}="1"] #${STICKY_READER_MASK_ID} {
    opacity: 0 !important;
    visibility: hidden !important;
  }
`;
let lastSiteStyleSignature = "";
const transientRevealTimers = new Set();
const TRANSIENT_REVEAL_DELAYS = [700, 1800];
function getStyleHost() {
    return document.head ?? document.documentElement ?? document.body;
}
function getMaskHost() {
    return document.body ?? document.documentElement;
}
function paintRootSurface() {
    if (document.documentElement) {
        document.documentElement.style.backgroundColor = "#f6efb6";
        document.documentElement.style.backgroundImage = "none";
        document.documentElement.style.color = "#231f15";
    }
    if (document.body) {
        document.body.style.backgroundColor = "#f6efb6";
        document.body.style.backgroundImage = "none";
        document.body.style.color = "#231f15";
    }
}
function ensureBaseThemeStyle() {
    paintRootSurface();
    const styleHost = getStyleHost();
    if (!styleHost) {
        return;
    }
    let styleElement = document.getElementById(STICKY_READER_BASE_STYLE_ID);
    if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = STICKY_READER_BASE_STYLE_ID;
        styleElement.textContent = STICKY_READER_BASE_THEME;
        styleHost.appendChild(styleElement);
        return;
    }
    if (styleElement.textContent !== STICKY_READER_BASE_THEME) {
        styleElement.textContent = STICKY_READER_BASE_THEME;
    }
    if (styleElement.parentElement !== styleHost) {
        styleHost.appendChild(styleElement);
    }
}
function ensureReaderMask() {
    const maskHost = getMaskHost();
    if (!maskHost) {
        return;
    }
    let maskElement = document.getElementById(STICKY_READER_MASK_ID);
    if (!maskElement) {
        maskElement = document.createElement("div");
        maskElement.id = STICKY_READER_MASK_ID;
        maskHost.appendChild(maskElement);
        return;
    }
    if (maskElement.parentElement !== maskHost) {
        maskHost.appendChild(maskElement);
    }
}
function ensureReaderShell() {
    ensureBaseThemeStyle();
    ensureReaderMask();
}
function setReaderMaskReady(isReady) {
    if (!document.documentElement) {
        return;
    }
    document.documentElement.setAttribute(STICKY_READER_READY_ATTR, isReady ? "1" : "0");
}
function syncReadyState() {
    if (!document.documentElement) {
        return;
    }
    if (document.documentElement.getAttribute(STICKY_READER_READY_ATTR) !== "1") {
        setReaderMaskReady(false);
    }
}
function isNovelpiaReadingPage(url) {
    const value = String(url || "").toLowerCase();
    if (!value.includes("novelpia.com")) {
        return false;
    }
    return [
        "/viewer/",
        "/reader/",
        "/episode/",
        "viewer",
        "reader",
        "episode",
        "chapter",
        "read"
    ].some((token) => value.includes(token));
}
function isMunpiaReadingPage(url) {
    const value = String(url || "").toLowerCase();
    if (!value.includes("munpia.com")) {
        return false;
    }
    return ((value.includes("action=view") && value.includes("entry_id="))
        || value.includes("viewratetype=list")
        || value.includes("/novel/")
        || value.includes("&num=")
        || value.includes("?num="));
}
function getSiteStyleHost() {
    return document.head ?? document.documentElement ?? document.body;
}
function buildDynamicSiteTheme(url) {
    if (isNovelpiaReadingPage(url)) {
        return `
      html,
      body,
      main,
      article,
      section,
      div,
      ul,
      ol,
      li,
      table,
      tr,
      td,
      th,
      p,
      span,
      strong,
      em,
      h1,
      h2,
      h3,
      h4,
      h5,
      h6,
      [class*='wrap'],
      [id*='wrap'],
      [class*='container'],
      [id*='container'],
      [class*='content'],
      [id*='content'],
      [class*='viewer'],
      [id*='viewer'],
      [class*='episode'],
      [id*='episode'] {
        background: var(--sticky-paper) !important;
        background-color: var(--sticky-paper) !important;
        background-image: none !important;
        color: var(--sticky-ink) !important;
        box-shadow: none !important;
        border-color: rgba(120, 109, 36, 0.24) !important;
      }

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

      img,
      picture,
      video,
      svg,
      canvas,
      figure,
      source,
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
        display: none !important;
        visibility: hidden !important;
      }
    `;
    }
    if (isMunpiaReadingPage(url)) {
        return `
      html,
      body {
        background: var(--sticky-paper) !important;
        background-color: var(--sticky-paper) !important;
        background-image: none !important;
        color: var(--sticky-ink) !important;
      }

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
      [class*='read_option'],
      [id*='read_option'],
      [class*='view_option'],
      [id*='view_option'],
      [class*='comment'],
      [id*='comment'],
      [class*='reply'],
      [id*='reply'],
      [class*='share'],
      [id*='share'],
      [class*='option'],
      [id*='option'],
      [class*='util'],
      [id*='util'] {
        background: var(--sticky-paper) !important;
        background-color: var(--sticky-paper) !important;
        background-image: none !important;
        box-shadow: none !important;
        border-color: rgba(120, 109, 36, 0.24) !important;
      }
    `;
    }
    return "";
}
function normalizeReaderText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}
function isNextEpisodeActionText(text) {
    return /다음\s*화|다음화|next/i.test(normalizeReaderText(text));
}
function isVisibleReaderElement(node) {
    if (!(node instanceof HTMLElement)) {
        return false;
    }
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || "1") > 0
        && rect.width > 0
        && rect.height > 0;
}
function hideMunpiaChromeEarly() {
    if (!isMunpiaReadingPage(window.location.href)) {
        return;
    }
    const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
    const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0);
    document.querySelectorAll("body *").forEach((node) => {
        if (!isVisibleReaderElement(node)) {
            return;
        }
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const text = normalizeReaderText(node.innerText || node.textContent || "");
        if (isNextEpisodeActionText(text)) {
            return;
        }
        if ((style.position === "fixed" || style.position === "sticky") && rect.width >= viewportWidth * 0.4 && rect.height <= 120) {
            const nearTop = rect.top <= 18 && rect.bottom <= 140;
            const nearBottom = rect.bottom >= viewportHeight - 10 && rect.top >= viewportHeight - 180;
            if (nearTop || nearBottom) {
                node.style.display = "none";
                return;
            }
        }
        const controlCount = node.querySelectorAll("button, [role='button'], a, input, select, textarea").length;
        const iconCount = node.querySelectorAll("svg, img, i").length;
        const nearBottomAction = rect.bottom >= viewportHeight - 8 && rect.top >= viewportHeight - 220 && rect.height <= 100;
        const looksLikeBottomAction = /목록|댓글|댓글로|위로|설정|가기|공유/.test(text) || controlCount >= 3;
        if (nearBottomAction && looksLikeBottomAction) {
            node.style.display = "none";
            return;
        }
        const nearUpperAction = rect.top > 90 && rect.top < 320 && rect.height <= 96;
        const looksLikeUpperAction = /조회|댓글|추천|선호|공유|가기/.test(text)
            || controlCount >= 2
            || iconCount >= 2;
        if (nearUpperAction && looksLikeUpperAction && text.length <= 80) {
            node.style.display = "none";
        }
    });
}
function ensureDynamicSiteStyle() {
    const siteStyleHost = getSiteStyleHost();
    if (!siteStyleHost) {
        return;
    }
    const siteStyle = buildDynamicSiteTheme(window.location.href);
    const nextSignature = `${window.location.href}|${siteStyle.length}`;
    let styleElement = document.getElementById(STICKY_READER_SITE_STYLE_ID);
    if (!siteStyle) {
        if (styleElement) {
            styleElement.remove();
        }
        lastSiteStyleSignature = "";
        return;
    }
    if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = STICKY_READER_SITE_STYLE_ID;
        siteStyleHost.appendChild(styleElement);
    }
    else if (styleElement.parentElement !== siteStyleHost) {
        siteStyleHost.appendChild(styleElement);
    }
    if (lastSiteStyleSignature !== nextSignature || styleElement.textContent !== siteStyle) {
        styleElement.textContent = siteStyle;
        lastSiteStyleSignature = nextSignature;
    }
}
function shouldTriggerTransientMask(target) {
    if (!(target instanceof Element)) {
        return false;
    }
    const actionNode = target.closest("a, button, [role='button']");
    if (!(actionNode instanceof HTMLElement)) {
        return false;
    }
    const rawText = [
        actionNode.innerText,
        actionNode.textContent,
        actionNode.getAttribute("aria-label"),
        actionNode.getAttribute("title"),
        actionNode.getAttribute("href"),
        actionNode.getAttribute("class"),
        actionNode.getAttribute("id")
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return [
        "다음",
        "next",
        "viewer",
        "episode",
        "chapter",
        "회차",
        "prev",
        "이전"
    ].some((token) => rawText.includes(token));
}
function scheduleTransientReveal() {
    if (!isNovelpiaReadingPage(window.location.href)) {
        return;
    }
    transientRevealTimers.forEach((timerId) => {
        window.clearTimeout(timerId);
    });
    transientRevealTimers.clear();
    setReaderMaskReady(false);
    ensureReaderShell();
    ensureDynamicSiteStyle();
    TRANSIENT_REVEAL_DELAYS.forEach((delay) => {
        const timerId = window.setTimeout(() => {
            transientRevealTimers.delete(timerId);
            ensureReaderShell();
            ensureDynamicSiteStyle();
            setReaderMaskReady(true);
        }, delay);
        transientRevealTimers.add(timerId);
    });
}
ensureReaderShell();
syncReadyState();
ensureDynamicSiteStyle();
hideMunpiaChromeEarly();
document.addEventListener("readystatechange", () => {
    ensureReaderShell();
    syncReadyState();
    ensureDynamicSiteStyle();
    hideMunpiaChromeEarly();
});
window.addEventListener("DOMContentLoaded", () => {
    ensureReaderShell();
    syncReadyState();
    ensureDynamicSiteStyle();
    hideMunpiaChromeEarly();
});
window.addEventListener("load", () => {
    ensureReaderShell();
    syncReadyState();
    ensureDynamicSiteStyle();
    hideMunpiaChromeEarly();
});
window.addEventListener("pageshow", () => {
    ensureReaderShell();
    syncReadyState();
    ensureDynamicSiteStyle();
    hideMunpiaChromeEarly();
});
window.addEventListener("click", (event) => {
    if (shouldTriggerTransientMask(event.target)) {
        scheduleTransientReveal();
    }
}, true);
const observer = new MutationObserver(() => {
    ensureReaderShell();
    ensureDynamicSiteStyle();
    hideMunpiaChromeEarly();
});
observer.observe(document, {
    childList: true,
    subtree: true
});
window.addEventListener("sticky-reader-go-back", () => {
    electron_1.ipcRenderer.send("reader:go-back");
});
