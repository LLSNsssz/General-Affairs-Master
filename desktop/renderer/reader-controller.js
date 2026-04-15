"use strict";
const readerEventListeners = new Map();
const readerState = {
    url: "",
    title: "",
    canGoBack: false,
    canGoForward: false,
    loading: false
};
let readerBackendBound = false;
let readerBoundsObserver = null;
function supportsNativeReaderBackend() {
    return typeof window.stickyDesktop !== "undefined";
}
function dispatchReaderEvent(type, event) {
    const listeners = readerEventListeners.get(type);
    if (!listeners) {
        return;
    }
    listeners.forEach((listener) => {
        listener(event);
    });
}
function bindNativeReaderBackend() {
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
function syncReaderBounds() {
    if (!supportsNativeReaderBackend() || !elements.browserStage) {
        return;
    }
    const rect = elements.browserStage.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(elements.browserStage);
    const hidden = computedStyle.display === "none" || rect.width < 1 || rect.height < 1;
    window.stickyDesktop?.setReaderBounds(hidden
        ? { x: 0, y: 0, width: 0, height: 0 }
        : {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        });
}
function startReaderController() {
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
const readerController = {
    isAttached() {
        if (!supportsNativeReaderBackend()) {
            return false;
        }
        bindNativeReaderBackend();
        return true;
    },
    addEventListener(type, listener) {
        if (!supportsNativeReaderBackend()) {
            return;
        }
        bindNativeReaderBackend();
        const listeners = readerEventListeners.get(type) ?? new Set();
        listeners.add(listener);
        readerEventListeners.set(type, listeners);
    },
    setSource(url) {
        if (!supportsNativeReaderBackend()) {
            return;
        }
        bindNativeReaderBackend();
        window.stickyDesktop?.navigateReader(url);
    },
    setVisible(visible) {
        if (!supportsNativeReaderBackend()) {
            return;
        }
        window.stickyDesktop?.setReaderVisible(Boolean(visible));
    },
    reload() {
        if (!supportsNativeReaderBackend()) {
            return;
        }
        window.stickyDesktop?.reloadReader();
    },
    canGoBack() {
        if (!supportsNativeReaderBackend()) {
            return false;
        }
        return readerState.canGoBack;
    },
    canGoForward() {
        if (!supportsNativeReaderBackend()) {
            return false;
        }
        return readerState.canGoForward;
    },
    goBack() {
        if (!supportsNativeReaderBackend()) {
            return;
        }
        if (readerController.canGoBack()) {
            window.stickyDesktop?.goBackReader();
        }
    },
    goForward() {
        if (!supportsNativeReaderBackend()) {
            return;
        }
        if (readerController.canGoForward()) {
            window.stickyDesktop?.goForwardReader();
        }
    },
    getURL() {
        if (!supportsNativeReaderBackend()) {
            return "";
        }
        return readerState.url;
    },
    getTitle() {
        if (!supportsNativeReaderBackend()) {
            return "";
        }
        return readerState.title;
    },
    async insertCSS(css) {
        if (!supportsNativeReaderBackend()) {
            return null;
        }
        return window.stickyDesktop?.insertReaderCSS(css) ?? null;
    },
    async removeInsertedCSS(key) {
        if (!supportsNativeReaderBackend()) {
            return;
        }
        await window.stickyDesktop?.removeReaderCSS(key);
    },
    async executeJavaScript(code, userGesture) {
        if (!supportsNativeReaderBackend()) {
            return null;
        }
        return window.stickyDesktop?.executeReaderJavaScript(code, userGesture) ?? null;
    }
};
