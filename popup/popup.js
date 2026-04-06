const DEFAULT_BOOKMARKS = [
  { id: "munpia", name: "Munpia", url: "https://novel.munpia.com/", meta: "Munpia home" },
  { id: "novelpia", name: "Novelpia", url: "https://novelpia.com/", meta: "Novelpia home" }
];

const DEFAULT_SETTINGS = {
  fontSize: 18,
  lineHeight: 1.9,
  paragraphGap: 18,
  showRuledLines: true
};

const DEFAULT_UI_STATE = {
  currentView: "home",
  scrollByView: {
    home: 0,
    reader: 0,
    settings: 0
  }
};

const STORAGE_KEYS = {
  bookmarks: "bookmarks",
  settings: "settings",
  recentPages: "recentPages",
  lastArticle: "lastArticle",
  uiState: "uiState"
};

const state = {
  currentView: "home",
  bookmarks: [...DEFAULT_BOOKMARKS],
  settings: { ...DEFAULT_SETTINGS },
  recentPages: [],
  lastArticle: null,
  uiState: createDefaultUiState()
};

const elements = {};
let uiPersistTimer = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  cacheElements();
  bindEvents();
  await hydrateState();
  render();
  restoreViewScroll();
  setStatus(state.lastArticle ? "Restored previous reading session" : "Ready");
}

function cacheElements() {
  elements.statusText = document.querySelector("#status-text");
  elements.refreshButton = document.querySelector("#refresh-reader");
  elements.viewButtons = [...document.querySelectorAll(".view-button")];
  elements.viewsContainer = document.querySelector(".views");
  elements.views = {
    home: document.querySelector("#home-view"),
    reader: document.querySelector("#reader-view"),
    settings: document.querySelector("#settings-view")
  };
  elements.readCurrentTabButton = document.querySelector("#read-current-tab");
  elements.bookmarkList = document.querySelector("#bookmark-list");
  elements.bookmarkForm = document.querySelector("#bookmark-form");
  elements.bookmarkName = document.querySelector("#bookmark-name");
  elements.bookmarkUrl = document.querySelector("#bookmark-url");
  elements.recentList = document.querySelector("#recent-list");
  elements.readerPaper = document.querySelector("#reader-paper");
  elements.readerEmpty = document.querySelector("#reader-empty");
  elements.readerContent = document.querySelector("#reader-content");
  elements.readerSite = document.querySelector("#reader-site");
  elements.readerTitle = document.querySelector("#reader-title");
  elements.readerMeta = document.querySelector("#reader-meta");
  elements.readerBody = document.querySelector("#reader-body");
  elements.fontSize = document.querySelector("#font-size");
  elements.fontSizeValue = document.querySelector("#font-size-value");
  elements.lineHeight = document.querySelector("#line-height");
  elements.lineHeightValue = document.querySelector("#line-height-value");
  elements.paragraphGap = document.querySelector("#paragraph-gap");
  elements.paragraphGapValue = document.querySelector("#paragraph-gap-value");
  elements.showRuledLines = document.querySelector("#show-ruled-lines");
}

function createDefaultUiState() {
  return {
    currentView: DEFAULT_UI_STATE.currentView,
    scrollByView: {
      home: DEFAULT_UI_STATE.scrollByView.home,
      reader: DEFAULT_UI_STATE.scrollByView.reader,
      settings: DEFAULT_UI_STATE.scrollByView.settings
    }
  };
}

function bindEvents() {
  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  elements.readCurrentTabButton.addEventListener("click", () => readCurrentTab());
  elements.refreshButton.addEventListener("click", () => readCurrentTab());

  elements.bookmarkForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addBookmark(elements.bookmarkName.value, elements.bookmarkUrl.value);
    elements.bookmarkForm.reset();
  });

  elements.fontSize.addEventListener("input", () => updateSetting("fontSize", Number(elements.fontSize.value)));
  elements.lineHeight.addEventListener("input", () => updateSetting("lineHeight", Number(elements.lineHeight.value)));
  elements.paragraphGap.addEventListener("input", () => updateSetting("paragraphGap", Number(elements.paragraphGap.value)));
  elements.showRuledLines.addEventListener("change", () => updateSetting("showRuledLines", elements.showRuledLines.checked));

  elements.viewsContainer.addEventListener("scroll", handleViewScroll, { passive: true });
  window.addEventListener("beforeunload", () => {
    captureCurrentScroll();
    persistUiState();
  });
}

async function hydrateState() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));

  state.bookmarks = Array.isArray(stored.bookmarks) && stored.bookmarks.length > 0
    ? stored.bookmarks
    : [...DEFAULT_BOOKMARKS];

  state.settings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  state.recentPages = Array.isArray(stored.recentPages) ? stored.recentPages : [];
  state.lastArticle = stored.lastArticle || null;
  state.uiState = mergeUiState(stored.uiState);
  state.currentView = getInitialView();
}

function mergeUiState(savedUiState) {
  const incoming = savedUiState && typeof savedUiState === "object" ? savedUiState : {};
  return {
    currentView: typeof incoming.currentView === "string" ? incoming.currentView : DEFAULT_UI_STATE.currentView,
    scrollByView: {
      ...DEFAULT_UI_STATE.scrollByView,
      ...(incoming.scrollByView || {})
    }
  };
}

function getInitialView() {
  if (state.uiState.currentView === "reader" && !state.lastArticle) {
    return "home";
  }

  if (["home", "reader", "settings"].includes(state.uiState.currentView)) {
    return state.uiState.currentView;
  }

  return "home";
}

function render() {
  renderViews();
  renderBookmarks();
  renderRecentPages();
  renderSettings();
  renderReader();
}

function renderViews() {
  Object.entries(elements.views).forEach(([viewName, node]) => {
    node.classList.toggle("is-active", state.currentView === viewName);
  });

  elements.viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.currentView);
  });
}

function renderBookmarks() {
  elements.bookmarkList.replaceChildren();

  if (state.bookmarks.length === 0) {
    elements.bookmarkList.append(createEmptyMessage("No bookmarks yet."));
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

    button.addEventListener("click", async () => {
      await chrome.tabs.create({ url: bookmark.url });
      setStatus(`Opened ${bookmark.name}`);
    });

    elements.bookmarkList.append(button);
  });
}

function renderRecentPages() {
  elements.recentList.replaceChildren();

  if (state.recentPages.length === 0) {
    elements.recentList.append(createEmptyMessage("No recent pages yet."));
    return;
  }

  state.recentPages.forEach((page) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-link";
    button.innerHTML = [
      `<span class="recent-title">${escapeHtml(page.title)}</span>`,
      `<span class="recent-meta">${escapeHtml(page.hostname)} | ${formatDate(page.capturedAt)}</span>`,
      `<span class="recent-excerpt">${escapeHtml(page.excerpt)}</span>`
    ].join("");

    button.addEventListener("click", async () => {
      await chrome.tabs.create({ url: page.url });
      setStatus("Opened recent page");
    });

    elements.recentList.append(button);
  });
}

function renderSettings() {
  elements.fontSize.value = String(state.settings.fontSize);
  elements.fontSizeValue.value = `${state.settings.fontSize}px`;

  elements.lineHeight.value = String(state.settings.lineHeight);
  elements.lineHeightValue.value = `${state.settings.lineHeight.toFixed(1)}`;

  elements.paragraphGap.value = String(state.settings.paragraphGap);
  elements.paragraphGapValue.value = `${state.settings.paragraphGap}px`;

  elements.showRuledLines.checked = state.settings.showRuledLines;

  document.documentElement.style.setProperty("--reader-font-size", `${state.settings.fontSize}px`);
  document.documentElement.style.setProperty("--reader-line-height", String(state.settings.lineHeight));
  document.documentElement.style.setProperty("--reader-paragraph-gap", `${state.settings.paragraphGap}px`);
  elements.readerPaper.classList.toggle("is-ruled", Boolean(state.settings.showRuledLines));
}

function renderReader() {
  if (!state.lastArticle || !state.lastArticle.content) {
    elements.readerEmpty.classList.remove("is-hidden");
    elements.readerContent.classList.add("is-hidden");
    return;
  }

  elements.readerEmpty.classList.add("is-hidden");
  elements.readerContent.classList.remove("is-hidden");
  elements.readerSite.textContent = state.lastArticle.hostname || "";
  elements.readerTitle.textContent = state.lastArticle.title || "Untitled";
  elements.readerMeta.textContent = [
    state.lastArticle.siteLabel ? `Adapter ${state.lastArticle.siteLabel}` : "",
    formatDate(state.lastArticle.capturedAt),
    state.lastArticle.stats?.paragraphCount ? `${state.lastArticle.stats.paragraphCount} paragraphs` : ""
  ].filter(Boolean).join(" | ");

  elements.readerBody.replaceChildren();
  splitParagraphs(state.lastArticle.content).forEach((paragraph) => {
    const node = document.createElement("p");
    node.textContent = paragraph;
    elements.readerBody.append(node);
  });
}

function setView(viewName) {
  if (!elements.views[viewName]) {
    return;
  }

  captureCurrentScroll();
  state.currentView = viewName;
  state.uiState.currentView = viewName;
  renderViews();
  restoreViewScroll();
  persistUiState();
}

function restoreViewScroll() {
  requestAnimationFrame(() => {
    const nextScrollTop = state.uiState.scrollByView[state.currentView] || 0;
    elements.viewsContainer.scrollTop = nextScrollTop;
  });
}

function handleViewScroll() {
  captureCurrentScroll();

  if (uiPersistTimer) {
    window.clearTimeout(uiPersistTimer);
  }

  uiPersistTimer = window.setTimeout(() => {
    persistUiState();
    uiPersistTimer = null;
  }, 120);
}

function captureCurrentScroll() {
  state.uiState.scrollByView[state.currentView] = elements.viewsContainer.scrollTop;
}

async function persistUiState() {
  await chrome.storage.local.set({ [STORAGE_KEYS.uiState]: state.uiState });
}

async function updateSetting(key, value) {
  state.settings[key] = value;
  renderSettings();
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: state.settings });
}

async function addBookmark(name, rawUrl) {
  const trimmedName = name.trim();
  const trimmedUrl = rawUrl.trim();

  if (!trimmedName || !trimmedUrl) {
    setStatus("Enter both name and URL.");
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    setStatus("Invalid URL.");
    return;
  }

  const nextBookmark = {
    id: crypto.randomUUID(),
    name: trimmedName,
    url: parsedUrl.toString(),
    meta: simplifyHost(parsedUrl.toString())
  };

  state.bookmarks = [nextBookmark, ...state.bookmarks].slice(0, 8);
  await chrome.storage.local.set({ [STORAGE_KEYS.bookmarks]: state.bookmarks });
  renderBookmarks();
  setStatus("Bookmark saved");
}

async function readCurrentTab() {
  setStatus("Extracting chapter text...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || typeof tab.id !== "number") {
      setStatus("Could not find the active tab.");
      return;
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractChapterContent
    });

    if (!result || !result.ok) {
      setStatus(result?.error || "Could not extract the chapter.");
      return;
    }

    state.lastArticle = result.article;
    state.recentPages = upsertRecentPage(state.recentPages, result.article);
    state.uiState.scrollByView.reader = 0;

    await chrome.storage.local.set({
      [STORAGE_KEYS.lastArticle]: state.lastArticle,
      [STORAGE_KEYS.recentPages]: state.recentPages
    });

    renderReader();
    renderRecentPages();
    setView("reader");
    setStatus(`Reader ready: ${state.lastArticle.title}`);
  } catch (error) {
    setStatus("The extension cannot run on this page.");
    console.error(error);
  }
}

function upsertRecentPage(existing, article) {
  const next = [article, ...existing.filter((item) => item.url !== article.url)];
  return next.slice(0, 10);
}

function createEmptyMessage(message) {
  const node = document.createElement("div");
  node.className = "empty-note";
  node.textContent = message;
  return node;
}

function setStatus(message) {
  elements.statusText.textContent = message;
}

function simplifyHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(isoString) {
  if (!isoString) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoString));
}

function splitParagraphs(content) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function extractChapterContent() {
  const blockedSchemes = ["chrome:", "chrome-extension:", "edge:", "about:"];
  if (blockedSchemes.includes(window.location.protocol)) {
    return { ok: false, error: "Browser internal pages cannot be read." };
  }

  const globalBlockedSelectors = [
    "script",
    "style",
    "noscript",
    "iframe",
    "canvas",
    "svg",
    "img",
    "picture",
    "video",
    "audio",
    "figure",
    "figcaption",
    "form",
    "button",
    "input",
    "textarea",
    "select",
    "nav",
    "header",
    "footer",
    "aside",
    "[aria-hidden='true']",
    "[class*='advert']",
    "[id*='advert']",
    "[class*='ads']",
    "[id*='ads']",
    "[class*='banner']",
    "[id*='banner']",
    "[class*='sponsor']",
    "[id*='sponsor']",
    "[class*='promo']",
    "[id*='promo']",
    "[class*='comment']",
    "[id*='comment']",
    "[class*='reply']",
    "[id*='reply']",
    "[class*='toolbar']",
    "[id*='toolbar']",
    "[class*='pagination']",
    "[id*='pagination']",
    "[class*='recommend']",
    "[id*='recommend']"
  ];

  const siteProfiles = [
    {
      key: "munpia",
      label: "Munpia",
      test: (host) => host.includes("munpia.com"),
      contentSelectors: [
        "#novel_content",
        "#revContents",
        ".viewer_contents",
        ".read_area",
        ".novel-content",
        ".view-content",
        ".view_content",
        ".detail_content",
        ".episode_content",
        "[class*='novel']",
        "[id*='novel']"
      ],
      titleSelectors: [
        ".title_wrap h1",
        ".view_hd h2",
        ".episode_top h2",
        "h1",
        "h2"
      ],
      blockedSelectors: [
        ".audiobook_wrap",
        ".comment_area",
        ".reply_area"
      ],
      boostKeywords: ["novel", "viewer", "episode", "content", "read", "view"],
      minTextLength: 180
    },
    {
      key: "novelpia",
      label: "Novelpia",
      test: (host) => host.includes("novelpia.com"),
      contentSelectors: [
        ".novel_view_area",
        ".novel_view",
        ".episode-content",
        ".ep-content",
        ".episode_viewer",
        ".viewer_body",
        ".view-body",
        ".reading-area",
        "#novel_content",
        ".novel-content",
        "[class*='episode']"
      ],
      titleSelectors: [
        ".episode-title",
        ".view-title",
        ".novel_title",
        "h1",
        "h2"
      ],
      blockedSelectors: [
        ".viewer_menu",
        ".comment_list",
        ".comment-area",
        ".choice-box",
        ".author_note"
      ],
      boostKeywords: ["episode", "viewer", "novel", "content", "story", "read"],
      minTextLength: 140
    }
  ];

  const genericSelectors = [
    "article",
    "main",
    "[role='main']",
    "[id*='content']",
    "[class*='content']",
    "[id*='chapter']",
    "[class*='chapter']",
    "[id*='viewer']",
    "[class*='viewer']"
  ];

  const activeProfile = siteProfiles.find((profile) => profile.test(window.location.hostname)) || null;
  const candidates = collectCandidates(activeProfile);
  const scored = candidates
    .map((element) => scoreElement(element))
    .filter((candidate) => candidate.text.length > (activeProfile?.minTextLength || 120))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best) {
    return { ok: false, error: "Could not find enough readable text." };
  }

  const titleCandidate = findTitleCandidate(best.element, activeProfile);
  const title = normalizeText(titleCandidate?.textContent || document.title || "Untitled");
  const paragraphs = splitParagraphs(best.text);

  return {
    ok: true,
    article: {
      title,
      content: best.text,
      excerpt: best.text.slice(0, 160).replace(/\s+/g, " "),
      hostname: window.location.hostname,
      url: window.location.href,
      capturedAt: new Date().toISOString(),
      siteKey: activeProfile?.key || "generic",
      siteLabel: activeProfile?.label || "Generic",
      stats: {
        paragraphCount: paragraphs.length,
        score: Math.round(best.score),
        candidateCount: scored.length
      }
    }
  };

  function collectCandidates(profile) {
    const selectors = [...new Set([...(profile?.contentSelectors || []), ...genericSelectors])];
    const seen = new Set();
    const collected = [];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }

        addCandidate(element);

        let ancestor = element.parentElement;
        let depth = 0;
        while (ancestor && depth < 2) {
          addCandidate(ancestor);
          ancestor = ancestor.parentElement;
          depth += 1;
        }
      });
    });

    const paragraphContainers = new Set();
    document.querySelectorAll("p, br").forEach((node) => {
      const container = node.parentElement;
      if (container instanceof HTMLElement) {
        paragraphContainers.add(container);
      }
    });

    [...paragraphContainers]
      .sort((left, right) => getTextLength(right) - getTextLength(left))
      .slice(0, 25)
      .forEach((element) => addCandidate(element));

    if (document.body) {
      addCandidate(document.body);
    }

    return collected;

    function addCandidate(element) {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      if (seen.has(element)) {
        return;
      }

      if (!isLikelyReadableContainer(element)) {
        return;
      }

      seen.add(element);
      collected.push(element);
    }
  }

  function findTitleCandidate(element, profile) {
    const selectors = [
      ...(profile?.titleSelectors || []),
      ".title",
      "[class*='title']",
      "h1",
      "h2"
    ];

    for (const selector of selectors) {
      const found = element.querySelector(selector);
      if (found && normalizeText(found.textContent || "").length > 2) {
        return found;
      }
    }

    return null;
  }

  function isLikelyReadableContainer(element) {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 40) {
      return getTextLength(element) > 400;
    }

    return true;
  }

  function scoreElement(element) {
    const clone = element.cloneNode(true);
    if (!(clone instanceof HTMLElement)) {
      return { element, score: 0, text: "" };
    }

    [...globalBlockedSelectors, ...(activeProfile?.blockedSelectors || [])]
      .forEach((selector) => {
        clone.querySelectorAll(selector).forEach((node) => node.remove());
      });

    clone.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    clone.querySelectorAll("p, div, li, section, article, h1, h2, h3, blockquote").forEach((node) => {
      if (node.textContent && node.textContent.trim().length > 0) {
        node.append(document.createTextNode("\n"));
      }
    });

    const text = normalizeText(clone.innerText || clone.textContent || "");
    const paragraphs = splitParagraphs(text);
    const paragraphCount = paragraphs.filter((line) => line.trim().length > 30).length;
    const averageParagraphLength = paragraphs.length > 0
      ? paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0) / paragraphs.length
      : 0;
    const linkLength = normalizeText(
      [...element.querySelectorAll("a")]
        .map((node) => node.textContent || "")
        .join(" ")
    ).length;
    const mediaCount = element.querySelectorAll("img, picture, video, audio, canvas, iframe, svg").length;
    const interactiveCount = element.querySelectorAll("button, input, textarea, select").length;
    const headingBonus = element.querySelectorAll("h1, h2, h3").length * 25;
    const punctuationScore = (text.match(/[.!?;:\u3002\uFF01\uFF1F]/g) || []).length * 2;
    const cjkScore = (text.match(/[\uAC00-\uD7A3\u4E00-\u9FFF]/g) || []).length * 0.2;
    const keywordBonus = getKeywordBonus(element, activeProfile?.boostKeywords || []);
    const score =
      text.length +
      paragraphCount * 220 +
      averageParagraphLength * 1.5 +
      headingBonus +
      punctuationScore +
      cjkScore +
      keywordBonus -
      Math.min(linkLength * 1.4, 900) -
      mediaCount * 120 -
      interactiveCount * 90;

    return { element, score, text };
  }

  function getKeywordBonus(element, keywords) {
    const haystack = [
      element.id,
      element.className,
      element.getAttribute("role"),
      element.getAttribute("data-type"),
      element.getAttribute("data-view")
    ].filter(Boolean).join(" ").toLowerCase();

    return keywords.reduce((score, keyword) => {
      return haystack.includes(keyword) ? score + 90 : score;
    }, 0);
  }

  function getTextLength(element) {
    return normalizeText(element.innerText || element.textContent || "").length;
  }

  function normalizeText(text) {
    return String(text)
      .replace(/\r/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function splitParagraphs(text) {
    return normalizeText(text)
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }
}
