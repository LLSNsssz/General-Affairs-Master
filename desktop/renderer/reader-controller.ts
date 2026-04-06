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

function syncReaderBounds(): void {
  if (!supportsNativeReaderBackend() || !elements.browserStage) {
    return;
  }

  const rect = elements.browserStage.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(elements.browserStage);
  const hidden = computedStyle.display === "none" || rect.width < 1 || rect.height < 1;

  window.stickyDesktop?.setReaderBounds(
    hidden
      ? { x: 0, y: 0, width: 0, height: 0 }
      : {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
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
