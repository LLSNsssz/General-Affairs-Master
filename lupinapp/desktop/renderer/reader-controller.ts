type ReaderEventListener = (event: RendererReaderEventPayload | { title?: string }) => void;

const readerEventListeners = new Map<string, Set<ReaderEventListener>>();
const readerState = {
  url: "",
  title: "",
  canGoBack: false,
  canGoForward: false,
  loading: false
};

let readerBackendBound = false;
let readerBoundsObserver: ResizeObserver | null = null;
type ReaderViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function supportsNativeReaderBackend(): boolean {
  return typeof window.stickyDesktop !== "undefined";
}

function dispatchReaderEvent(type: string, event: RendererReaderEventPayload | { title?: string }): void {
  const listeners = readerEventListeners.get(type);
  if (!listeners) {
    return;
  }

  listeners.forEach((listener) => {
    listener(event);
  });
}

function bindNativeReaderBackend(): void {
  if (!supportsNativeReaderBackend() || readerBackendBound) {
    return;
  }

  window.stickyDesktop?.onReaderEvent((event) => {
    readerState.url = event.url;
    readerState.title = event.title;
    readerState.canGoBack = event.canGoBack;
    readerState.canGoForward = event.canGoForward;
    readerState.loading = event.loading;
    dispatchReaderEvent(event.type, event);
  });

  readerBackendBound = true;
}

function toViewportRect(rect: DOMRect | ReaderViewportRect): ReaderViewportRect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(0, Math.round(rect.width)),
    height: Math.max(0, Math.round(rect.height))
  };
}

function getRectRight(rect: ReaderViewportRect): number {
  return rect.x + rect.width;
}

function getRectBottom(rect: ReaderViewportRect): number {
  return rect.y + rect.height;
}

function rectsIntersect(base: ReaderViewportRect, target: ReaderViewportRect): boolean {
  return (
    base.width > 0
    && base.height > 0
    && target.width > 0
    && target.height > 0
    && base.x < getRectRight(target)
    && getRectRight(base) > target.x
    && base.y < getRectBottom(target)
    && getRectBottom(base) > target.y
  );
}

function clampRectToRect(base: ReaderViewportRect, target: ReaderViewportRect): ReaderViewportRect | null {
  const left = Math.max(base.x, target.x);
  const top = Math.max(base.y, target.y);
  const right = Math.min(getRectRight(base), getRectRight(target));
  const bottom = Math.min(getRectBottom(base), getRectBottom(target));
  const width = right - left;
  const height = bottom - top;

  if (width < 1 || height < 1) {
    return null;
  }

  return { x: left, y: top, width, height };
}

function subtractRect(base: ReaderViewportRect, overlay: ReaderViewportRect): ReaderViewportRect[] {
  if (!rectsIntersect(base, overlay)) {
    return [base];
  }

  const clippedOverlay = clampRectToRect(base, overlay);
  if (!clippedOverlay) {
    return [base];
  }

  const candidates: ReaderViewportRect[] = [
    {
      x: base.x,
      y: base.y,
      width: base.width,
      height: clippedOverlay.y - base.y
    },
    {
      x: base.x,
      y: getRectBottom(clippedOverlay),
      width: base.width,
      height: getRectBottom(base) - getRectBottom(clippedOverlay)
    },
    {
      x: base.x,
      y: base.y,
      width: clippedOverlay.x - base.x,
      height: base.height
    },
    {
      x: getRectRight(clippedOverlay),
      y: base.y,
      width: getRectRight(base) - getRectRight(clippedOverlay),
      height: base.height
    }
  ];

  return candidates.filter((candidate) => candidate.width >= 1 && candidate.height >= 1);
}

function getOverlayRect(element: HTMLElement | null | undefined, stageRect: ReaderViewportRect): ReaderViewportRect | null {
  if (!element || element.classList.contains("is-hidden") || !element.classList.contains("is-open")) {
    return null;
  }

  const rect = clampRectToRect(stageRect, toViewportRect(element.getBoundingClientRect()));
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

function getObscuringOverlayRects(stageRect: ReaderViewportRect): ReaderViewportRect[] {
  return [
    getOverlayRect(elements.helpPopup, stageRect),
    getOverlayRect(elements.settingsPopup, stageRect),
    getOverlayRect(elements.bookmarkDrawer, stageRect),
    getOverlayRect(elements.recentDrawer, stageRect)
  ].filter((rect): rect is ReaderViewportRect => Boolean(rect));
}

function computeReaderViewport(stageRect: ReaderViewportRect): ReaderViewportRect {
  const overlays = getObscuringOverlayRects(stageRect);
  if (overlays.length === 0) {
    return stageRect;
  }

  let candidates: ReaderViewportRect[] = [stageRect];
  overlays.forEach((overlay) => {
    candidates = candidates.flatMap((candidate) => subtractRect(candidate, overlay));
  });

  if (candidates.length === 0) {
    return {
      x: stageRect.x,
      y: stageRect.y,
      width: 0,
      height: 0
    };
  }

  return candidates.sort((left, right) => (right.width * right.height) - (left.width * left.height))[0];
}

function syncReaderBounds(): void {
  if (!supportsNativeReaderBackend() || !elements.browserStage) {
    return;
  }

  const rect = toViewportRect(elements.browserStage.getBoundingClientRect());
  const computedStyle = window.getComputedStyle(elements.browserStage);
  const hidden = computedStyle.display === "none"
    || rect.width < 1
    || rect.height < 1;
  const viewport = hidden ? rect : computeReaderViewport(rect);

  window.stickyDesktop?.setReaderBounds(
    hidden
      ? { x: 0, y: 0, width: 0, height: 0 }
      : viewport
  );
}

function startReaderController(): void {
  if (!supportsNativeReaderBackend()) {
    return;
  }

  bindNativeReaderBackend();

  if (readerBoundsObserver) {
    readerBoundsObserver.disconnect();
    readerBoundsObserver = null;
  }

  if (elements.browserStage && "ResizeObserver" in window) {
    readerBoundsObserver = new ResizeObserver(() => {
      syncReaderBounds();
    });
    readerBoundsObserver.observe(elements.browserStage);
  }

  window.addEventListener("resize", syncReaderBounds);
  window.requestAnimationFrame(() => {
    syncReaderBounds();
  });
}

const readerController: RendererReaderController = {
  isAttached(): boolean {
    if (!supportsNativeReaderBackend()) {
      return false;
    }

    bindNativeReaderBackend();
    return true;
  },

  addEventListener(type: string, listener: (event: any) => void): void {
    if (!supportsNativeReaderBackend()) {
      return;
    }

    bindNativeReaderBackend();
    const listeners = readerEventListeners.get(type) ?? new Set<ReaderEventListener>();
    listeners.add(listener);
    readerEventListeners.set(type, listeners);
  },

  setSource(url: string): void {
    if (!supportsNativeReaderBackend()) {
      return;
    }

    bindNativeReaderBackend();
    window.stickyDesktop?.navigateReader(url);
  },

  setVisible(visible: boolean): void {
    if (!supportsNativeReaderBackend()) {
      return;
    }

    window.stickyDesktop?.setReaderVisible(Boolean(visible));
  },

  reload(): void {
    if (!supportsNativeReaderBackend()) {
      return;
    }

    window.stickyDesktop?.reloadReader();
  },

  canGoBack(): boolean {
    if (!supportsNativeReaderBackend()) {
      return false;
    }

    return readerState.canGoBack;
  },

  canGoForward(): boolean {
    if (!supportsNativeReaderBackend()) {
      return false;
    }

    return readerState.canGoForward;
  },

  goBack(): void {
    if (!supportsNativeReaderBackend()) {
      return;
    }

    if (readerController.canGoBack()) {
      window.stickyDesktop?.goBackReader();
    }
  },

  goForward(): void {
    if (!supportsNativeReaderBackend()) {
      return;
    }

    if (readerController.canGoForward()) {
      window.stickyDesktop?.goForwardReader();
    }
  },

  getURL(): string {
    if (!supportsNativeReaderBackend()) {
      return "";
    }

    return readerState.url;
  },

  getTitle(): string {
    if (!supportsNativeReaderBackend()) {
      return "";
    }

    return readerState.title;
  },

  async insertCSS(css: string): Promise<string | null> {
    if (!supportsNativeReaderBackend()) {
      return null;
    }

    return window.stickyDesktop?.insertReaderCSS(css) ?? null;
  },

  async removeInsertedCSS(key: string): Promise<void> {
    if (!supportsNativeReaderBackend()) {
      return;
    }

    await window.stickyDesktop?.removeReaderCSS(key);
  },

  async executeJavaScript<T = unknown>(code: string, userGesture?: boolean): Promise<T | null> {
    if (!supportsNativeReaderBackend()) {
      return null;
    }

    return window.stickyDesktop?.executeReaderJavaScript<T>(code, userGesture) ?? null;
  }
};
