import { ipcRenderer } from "electron";

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
const transientRevealTimers = new Set<number>();
const TRANSIENT_REVEAL_DELAYS = [700, 1800];
type ReaderPreloadSiteId = "novelpia" | "munpia" | "kakaopage" | "joara";

type ReaderPreloadSiteRule = {
  id: ReaderPreloadSiteId;
  hosts: string[];
  readingTokens: string[];
};

const READER_PRELOAD_SITE_RULES: ReaderPreloadSiteRule[] = [
  {
    id: "novelpia",
    hosts: ["novelpia.com"],
    readingTokens: ["/viewer/", "/reader/", "/episode/", "viewer", "reader", "episode", "chapter", "read"]
  },
  {
    id: "munpia",
    hosts: ["munpia.com"],
    readingTokens: ["/novel/", "/page/", "work/view", "action=view", "entry_id=", "viewratetype=list", "?num=", "&num="]
  },
  {
    id: "kakaopage",
    hosts: ["page.kakao.com"],
    readingTokens: ["/content/"]
  },
  {
    id: "joara",
    hosts: ["joara.com"],
    readingTokens: ["/book/", "/viewer/", "book", "viewer", "read", "episode", "chapter", "story"]
  }
];

function normalizeReaderPreloadUrl(url: string): string {
  return String(url || "").toLowerCase();
}

function getReaderPreloadSiteRule(url: string): ReaderPreloadSiteRule | null {
  const value = normalizeReaderPreloadUrl(url);
  return READER_PRELOAD_SITE_RULES.find((rule) => rule.hosts.some((host) => value.includes(host))) ?? null;
}

function isMunpiaPreloadReadingUrl(url: string): boolean {
  const value = normalizeReaderPreloadUrl(url);
  if (!value.includes("munpia.com")) {
    return false;
  }

  if (value.includes("/novel/detail/") || value.includes("viewratetype=list")) {
    return false;
  }

  return (
    (value.includes("action=view") && value.includes("entry_id="))
    || value.includes("viewratetype=continue")
    || value.includes("viewratetype=replay")
    || value.includes("/viewer/")
    || value.includes("/read/")
    || value.includes("?num=")
    || value.includes("&num=")
  );
}

function isReaderPreloadReadingPage(siteId: ReaderPreloadSiteId, url: string): boolean {
  const value = normalizeReaderPreloadUrl(url);
  const rule = getReaderPreloadSiteRule(value);
  if (!rule || rule.id !== siteId) {
    return false;
  }

  if (siteId === "munpia") {
    return isMunpiaPreloadReadingUrl(value);
  }

  return rule.readingTokens.some((token) => value.includes(token));
}

function getStyleHost(): HTMLElement | null {
  return document.head ?? document.documentElement ?? document.body;
}

function getMaskHost(): HTMLElement | null {
  return document.body ?? document.documentElement;
}

function paintRootSurface(): void {
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

function ensureBaseThemeStyle(): void {
  paintRootSurface();

  const styleHost = getStyleHost();
  if (!styleHost) {
    return;
  }

  let styleElement = document.getElementById(STICKY_READER_BASE_STYLE_ID) as HTMLStyleElement | null;
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

function ensureReaderMask(): void {
  const maskHost = getMaskHost();
  if (!maskHost) {
    return;
  }

  let maskElement = document.getElementById(STICKY_READER_MASK_ID) as HTMLDivElement | null;
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

function ensureReaderShell(): void {
  ensureBaseThemeStyle();
  ensureReaderMask();
}

function setReaderMaskReady(isReady: boolean): void {
  if (!document.documentElement) {
    return;
  }

  document.documentElement.setAttribute(STICKY_READER_READY_ATTR, isReady ? "1" : "0");
}

function syncReadyState(): void {
  if (!document.documentElement) {
    return;
  }

  if (document.documentElement.getAttribute(STICKY_READER_READY_ATTR) !== "1") {
    setReaderMaskReady(false);
  }
}

function isNovelpiaReadingPage(url: string): boolean {
  return isReaderPreloadReadingPage("novelpia", url);
}

function isMunpiaReadingPage(url: string): boolean {
  return isReaderPreloadReadingPage("munpia", url);
}

function getSiteStyleHost(): HTMLElement | null {
  return document.head ?? document.documentElement ?? document.body;
}

function buildDynamicSiteTheme(url: string): string {
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
      [id*='view_option'],
      #i-am-progress-indicator,
      #back_info_layer,
      #next_info_layer {
        display: none !important;
        visibility: hidden !important;
        max-height: 0 !important;
        overflow: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
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

      hr,
      [class*='divider'],
      [id*='divider'],
      [class*='separator'],
      [id*='separator'],
      [class*='split-line'],
      [id*='split-line'] {
        display: none !important;
        visibility: hidden !important;
        border: 0 !important;
        background: transparent !important;
      }

      #novel_content p,
      #novelContent p,
      .novel_view_area p,
      .novel_view p,
      .viewer_contents p,
      .viewer_body p,
      .episode-content p,
      .read_area p,
      article p,
      main p,
      #novel_content span,
      #novelContent span,
      .novel_view_area span,
      .novel_view span,
      .viewer_contents span,
      .viewer_body span,
      .episode-content span,
      .read_area span,
      article span,
      main span {
        text-decoration: none !important;
        border-top: 0 !important;
        border-bottom: 0 !important;
        box-shadow: none !important;
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

function normalizeReaderText(value: string | null | undefined): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isNextEpisodeActionText(text: string): boolean {
  return /다음\s*화|다음화|next/i.test(normalizeReaderText(text));
}

function isVisibleReaderElement(node: Element | null): node is HTMLElement {
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

function hideMunpiaChromeEarly(): void {
  if (!isMunpiaReadingPage(window.location.href)) {
    return;
  }

  const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
  const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0);
  const looksLikeThinDivider = (node: HTMLElement, rect: DOMRect, text: string, style: CSSStyleDeclaration): boolean => {
    const descriptor = [
      node.tagName,
      node.className,
      node.id,
      node.getAttribute('role')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const controlCount = node.querySelectorAll('button, [role="button"], a, input, select, textarea').length;
    const borderTop = Number.parseFloat(style.borderTopWidth || '0');
    const borderBottom = Number.parseFloat(style.borderBottomWidth || '0');

    return controlCount === 0
      && (
        node.tagName.toLowerCase() === 'hr'
        || descriptor.includes('divider')
        || descriptor.includes('separator')
        || descriptor.includes('split')
        || (text.length === 0 && rect.width >= 120 && rect.height <= 4)
        || (text.length === 0 && rect.width >= 120 && rect.height <= 12 && (borderTop >= 1 || borderBottom >= 1))
      );
  };

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
      return;
    }

    const nearUpperDivider = rect.top > 40 && rect.top < 260 && rect.width >= viewportWidth * 0.45;
    if (nearUpperDivider && looksLikeThinDivider(node, rect, text, style)) {
      node.style.display = 'none';
    }
  });
}

function hideNovelpiaInlineOverlays(): void {
  if (!isNovelpiaReadingPage(window.location.href)) {
    return;
  }

  if (document.body?.getAttribute("data-sticky-novelpia-adapter") === "1") {
    return;
  }

  const readerRoot = (
    document.getElementById("novel_drawing_page")
    || document.getElementById("novel_drawing")
    || document.getElementById("novel_text")
    || document.getElementById("novel_box")
  );

  if (!(readerRoot instanceof HTMLElement)) {
    return;
  }

  const readerRect = readerRoot.getBoundingClientRect();
  if (readerRect.width < 120 || readerRect.height < 80) {
    return;
  }

  const preserveSelector = [
    "#header_bar",
    "#footer_bar",
    "#theme_box",
    "#comment_box",
    "#list_box",
    "#float-menu",
    "#scroll_up_btn",
    "#scroll_down_btn",
    "#back_info_layer",
    "#next_info_layer",
    "#load_bar",
    "#novel_box",
    "#novel_text",
    "#novel_drawing",
    "#novel_drawing_page",
    "#novel_drawing_page_c",
    "#novel_drawing_left",
    "#novel_drawing_right"
  ].join(", ");

  const topMin = readerRect.top + 12;
  const topMax = readerRect.top + Math.min(260, Math.max(120, readerRect.height * 0.22));
  const likelyMetaText = (text: string): boolean => {
    return /(댓글|comment|추천|recommend|더보기|미보유콘|작가티콘|\(\d+\)|\d+\s*개|>\s*$)/i.test(text);
  };

  [
    document.getElementById("writer_comments_box"),
    ...Array.from(document.querySelectorAll("[id*='writer_comment'], [class*='writer-comment']"))
  ].forEach((node) => {
    if (node instanceof HTMLElement) {
      node.style.display = "none";
    }
  });

  readerRoot.querySelectorAll("*").forEach((node) => {
    if (!isVisibleReaderElement(node)) {
      return;
    }

    if (node.matches("font, p, span, br, strong, em, b, i")) {
      return;
    }

    const preservedAncestor = node.closest(preserveSelector);
    if (preservedAncestor && preservedAncestor !== node) {
      return;
    }

    if (readerRoot.contains(node) && node.closest("font.line, .line, p")) {
      return;
    }

    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    if (rect.top < topMin || rect.top > topMax || rect.width < 120 || rect.height > 56) {
      return;
    }

    const text = normalizeReaderText(node.innerText || node.textContent || "");
    const controlCount = node.querySelectorAll("button, [role='button'], a, input, select, textarea").length;
    const isOverlayPosition = style.position === "absolute" || style.position === "fixed" || style.position === "sticky";
    const descriptor = [
      node.id,
      node.className,
      node.getAttribute("role")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      likelyMetaText(text)
      && text.length <= 32
      && controlCount <= 2
      && (isOverlayPosition || !readerRoot.contains(node) || descriptor.includes("comment") || descriptor.includes("recommend"))
    ) {
      (node as HTMLElement).style.display = "none";
      return;
    }

    const looksLikeThinDivider = text.length === 0
      && rect.height <= 8
      && rect.width >= Math.max(160, readerRect.width * 0.45);

    if (
      looksLikeThinDivider
      && (isOverlayPosition || descriptor.includes("divider") || descriptor.includes("separator") || descriptor.includes("comment"))
    ) {
      (node as HTMLElement).style.display = "none";
    }
  });
}

function ensureDynamicSiteStyle(): void {
  const siteStyleHost = getSiteStyleHost();
  if (!siteStyleHost) {
    return;
  }

  const siteStyle = buildDynamicSiteTheme(window.location.href);
  const nextSignature = `${window.location.href}|${siteStyle.length}`;
  let styleElement = document.getElementById(STICKY_READER_SITE_STYLE_ID) as HTMLStyleElement | null;

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
  } else if (styleElement.parentElement !== siteStyleHost) {
    siteStyleHost.appendChild(styleElement);
  }

  if (lastSiteStyleSignature !== nextSignature || styleElement.textContent !== siteStyle) {
    styleElement.textContent = siteStyle;
    lastSiteStyleSignature = nextSignature;
  }
}

function shouldTriggerTransientMask(target: EventTarget | null): boolean {
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

function scheduleTransientReveal(): void {
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

let preloadMaintenanceTimer = 0;
let preloadMaintenanceQueued = false;
let observerStarted = false;

const observer = new MutationObserver(() => {
  scheduleReaderPreloadMaintenance(80);
});

function ensurePreloadObserver(): void {
  if (observerStarted) {
    return;
  }

  const target = document.body ?? document.documentElement;
  if (!(target instanceof Node)) {
    return;
  }

  observer.observe(target, {
    childList: true,
    subtree: true
  });
  observerStarted = true;
}

function runReaderPreloadMaintenance(): void {
  ensurePreloadObserver();
  ensureReaderShell();
  syncReadyState();
  ensureDynamicSiteStyle();
  hideNovelpiaInlineOverlays();
  hideMunpiaChromeEarly();
}

function scheduleReaderPreloadMaintenance(delay = 80): void {
  if (preloadMaintenanceQueued) {
    return;
  }

  preloadMaintenanceQueued = true;
  preloadMaintenanceTimer = window.setTimeout(() => {
    preloadMaintenanceQueued = false;
    preloadMaintenanceTimer = 0;
    runReaderPreloadMaintenance();
  }, delay);
}

runReaderPreloadMaintenance();

document.addEventListener("readystatechange", () => {
  scheduleReaderPreloadMaintenance(0);
});

window.addEventListener("DOMContentLoaded", () => {
  scheduleReaderPreloadMaintenance(0);
});

window.addEventListener("load", () => {
  scheduleReaderPreloadMaintenance(0);
});

window.addEventListener("pageshow", () => {
  scheduleReaderPreloadMaintenance(0);
});

window.addEventListener("click", (event) => {
  if (shouldTriggerTransientMask(event.target)) {
    scheduleTransientReveal();
  }
}, true);

window.setTimeout(() => {
  observer.disconnect();
  if (preloadMaintenanceTimer) {
    window.clearTimeout(preloadMaintenanceTimer);
    preloadMaintenanceTimer = 0;
  }
  preloadMaintenanceQueued = false;
}, 5000);

window.addEventListener("sticky-reader-go-back", () => {
  ipcRenderer.send("reader:go-back");
});
