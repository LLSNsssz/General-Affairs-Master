function navigateTo(rawUrl: unknown): void {
  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    setStatus("Enter a valid URL");
    return;
  }

  closeDrawers();
  state.currentUrl = targetUrl;
  persistScalar(STORAGE_KEYS.currentUrl, targetUrl);
  renderHelpSiteList();
  if (elements.addressInput) {
    elements.addressInput.value = targetUrl;
  }
  readerController.setVisible(false);
  setLoading(true);
  readerController.setSource(targetUrl);
  window.clearTimeout(loadingFallbackTimer);
  loadingFallbackTimer = window.setTimeout(() => {
    setStageNotice("Loading", "Still preparing the reading board", "The site is taking a little longer than usual.");
  }, 3500);
  setStatus(`Opening ${simplifyHost(targetUrl)}`);
}

function addBookmark(name: string, rawUrl: unknown): void {
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

function syncNavigationState(): void {
  if (!readerController.isAttached()) {
    return;
  }

  const currentUrl = readerController.getURL() || state.currentUrl;
  if (currentUrl) {
    state.currentUrl = currentUrl;
    if (elements.addressInput) {
      elements.addressInput.value = currentUrl;
    }
    persistScalar(STORAGE_KEYS.currentUrl, currentUrl);
  }

  const title = readerController.getTitle() || simplifyHost(currentUrl);
  if (elements.pageTitle) {
    elements.pageTitle.textContent = title;
  }
  renderHelpSiteList();
  rememberPage(currentUrl, title);
}

function mergePresetBookmarks(savedBookmarks: unknown): RendererBookmarkRecord[] {
  const remainingBookmarks: RendererBookmarkDraft[] = Array.isArray(savedBookmarks)
    ? [...savedBookmarks] as RendererBookmarkDraft[]
    : [];
  const filteredBookmarks = remainingBookmarks.filter((bookmark) => !urlsShareHost(bookmark?.url, "https://series.naver.com/"));
  const mergedPresets = SITE_PRESETS.map((site) => {
    const matchIndex = filteredBookmarks.findIndex((bookmark) => {
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

    const [bookmark] = filteredBookmarks.splice(matchIndex, 1);
    return {
      ...bookmark,
      id: site.id,
      name: site.name,
      url: getPresetHomeUrl(site),
      meta: getPresetMeta(site)
    } as RendererBookmarkRecord;
  });

  return mergedPresets.concat(
    filteredBookmarks
      .filter((bookmark): bookmark is RendererBookmarkDraft & { url: string } => Boolean(bookmark && bookmark.url))
      .map((bookmark) => ({
        id: bookmark.id || crypto.randomUUID(),
        name: bookmark.name || simplifyHost(bookmark.url),
        url: bookmark.url,
        meta: bookmark.meta || simplifyHost(bookmark.url)
      }))
  );
}

function rememberPage(url: string, title: string): void {
  if (!url || !/^https?:/i.test(url)) {
    return;
  }

  const entry: RendererRecentPageRecord = {
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

function getInitialUrl(): string {
  const storedUrl = localStorage.getItem(STORAGE_KEYS.currentUrl);
  const normalizedStoredUrl = normalizeUrl(storedUrl);
  if (normalizedStoredUrl && /^https?:/i.test(normalizedStoredUrl) && !normalizedStoredUrl.startsWith("chrome-error://")) {
    if (urlsShareHost(normalizedStoredUrl, "https://series.naver.com/")) {
      return getPresetHomeUrl(SITE_PRESETS[0]);
    }

    if (normalizedStoredUrl.includes("m.joara.com")) {
      return getPresetHomeUrl(SITE_PRESETS.find((site) => site.id === "joara"));
    }

    if (normalizedStoredUrl.includes("mm.munpia.com/main")) {
      return getPresetHomeUrl(SITE_PRESETS.find((site) => site.id === "munpia"));
    }

    if (
      normalizedStoredUrl.includes("/proc/login_kakao") ||
      normalizedStoredUrl.includes("accounts.kakao.com/") ||
      normalizedStoredUrl.includes("kauth.kakao.com/")
    ) {
      return getPresetHomeUrl(SITE_PRESETS.find((site) => site.id === "novelpia"));
    }

    return normalizedStoredUrl;
  }

  return getPresetHomeUrl(SITE_PRESETS[0]);
}
