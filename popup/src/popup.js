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

const STORAGE_KEYS = {
  bookmarks: "bookmarks",
  settings: "settings",
  recentPages: "recentPages",
  lastArticle: "lastArticle"
};

const state = {
  currentView: "home",
  bookmarks: [...DEFAULT_BOOKMARKS],
  settings: { ...DEFAULT_SETTINGS },
  recentPages: [],
  lastArticle: null
};

const elements = {};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  cacheElements();
  bindEvents();
  await hydrateState();
  render();
}

function cacheElements() {
  elements.statusText = document.querySelector("#status-text");
  elements.refreshButton = document.querySelector("#refresh-reader");
  elements.viewButtons = [...document.querySelectorAll(".view-button")];
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
}

async function hydrateState() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  state.bookmarks = Array.isArray(stored.bookmarks) && stored.bookmarks.length > 0
    ? stored.bookmarks
    : [...DEFAULT_BOOKMARKS];
  state.settings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  state.recentPages = Array.isArray(stored.recentPages) ? stored.recentPages : [];
  state.lastArticle = stored.lastArticle || null;
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
    formatDate(state.lastArticle.capturedAt),
    state.lastArticle.url
  ].filter(Boolean).join(" | ");

  elements.readerBody.replaceChildren();
  splitParagraphs(state.lastArticle.content).forEach((paragraph) => {
    const node = document.createElement("p");
    node.textContent = paragraph;
    elements.readerBody.append(node);
  });
}

function setView(viewName) {
  state.currentView = viewName;
  renderViews();
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

  const siteProfiles = [
    {
      test: (host) => host.includes("munpia.com"),
      selectors: [
        "#novel_content",
        ".novel-content",
        ".view-content",
        "[class*='novel']",
        "[id*='novel']"
      ]
    },
    {
      test: (host) => host.includes("novelpia.com"),
      selectors: [
        ".episode-content",
        ".ep-content",
        "#novel_content",
        ".novel-content",
        "[class*='episode']"
      ]
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

  const activeProfile = siteProfiles.find((profile) => profile.test(window.location.hostname));
  const selectors = [...new Set([...(activeProfile?.selectors || []), ...genericSelectors])];
  const candidates = [];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element instanceof HTMLElement) {
        candidates.push(element);
      }
    });
  });

  if (candidates.length === 0 && document.body) {
    candidates.push(document.body);
  }

  const scored = candidates
    .map((element) => scoreElement(element))
    .filter((candidate) => candidate.text.length > 120)
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best) {
    return { ok: false, error: "Could not find enough readable text." };
  }

  const titleCandidate = best.element.querySelector("h1, h2, .title, [class*='title']");
  const title = normalizeText(titleCandidate?.textContent || document.title || "Untitled");

  return {
    ok: true,
    article: {
      title,
      content: best.text,
      excerpt: best.text.slice(0, 120).replace(/\s+/g, " "),
      hostname: window.location.hostname,
      url: window.location.href,
      capturedAt: new Date().toISOString()
    }
  };

  function scoreElement(element) {
    const clone = element.cloneNode(true);
    if (!(clone instanceof HTMLElement)) {
      return { element, score: 0, text: "" };
    }

    clone.querySelectorAll([
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
      "[id*='promo']"
    ].join(",")).forEach((node) => node.remove());

    clone.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
    clone.querySelectorAll("p, div, li, section").forEach((node) => {
      if (node.textContent && node.textContent.trim().length > 0) {
        node.append(document.createTextNode("\n"));
      }
    });

    const text = normalizeText(clone.innerText || clone.textContent || "");
    const paragraphCount = text.split(/\n{2,}/).filter((line) => line.trim().length > 30).length;
    const linkLength = normalizeText(
      [...element.querySelectorAll("a")]
        .map((node) => node.textContent || "")
        .join(" ")
    ).length;
    const score = text.length + paragraphCount * 160 - Math.min(linkLength, 500);

    return { element, score, text };
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
}
