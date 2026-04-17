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
function toViewportRect(rect) {
    return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height))
    };
}
function getRectRight(rect) {
    return rect.x + rect.width;
}
function getRectBottom(rect) {
    return rect.y + rect.height;
}
function rectsIntersect(base, target) {
    return (base.width > 0
        && base.height > 0
        && target.width > 0
        && target.height > 0
        && base.x < getRectRight(target)
        && getRectRight(base) > target.x
        && base.y < getRectBottom(target)
        && getRectBottom(base) > target.y);
}
function clampRectToRect(base, target) {
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
function subtractRect(base, overlay) {
    if (!rectsIntersect(base, overlay)) {
        return [base];
    }
    const clippedOverlay = clampRectToRect(base, overlay);
    if (!clippedOverlay) {
        return [base];
    }
    const candidates = [
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
function getOverlayRect(element, stageRect) {
    if (!element || element.classList.contains("is-hidden") || !element.classList.contains("is-open")) {
        return null;
    }
    const rect = clampRectToRect(stageRect, toViewportRect(element.getBoundingClientRect()));
    return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}
function getObscuringOverlayRects(stageRect) {
    return [
        getOverlayRect(elements.helpPopup, stageRect),
        getOverlayRect(elements.settingsPopup, stageRect),
        getOverlayRect(elements.bookmarkDrawer, stageRect),
        getOverlayRect(elements.recentDrawer, stageRect)
    ].filter((rect) => Boolean(rect));
}
function computeReaderViewport(stageRect) {
    const overlays = getObscuringOverlayRects(stageRect);
    if (overlays.length === 0) {
        return stageRect;
    }
    let candidates = [stageRect];
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
function syncReaderBounds() {
    if (!supportsNativeReaderBackend() || !elements.browserStage) {
        return;
    }
    const rect = toViewportRect(elements.browserStage.getBoundingClientRect());
    const computedStyle = window.getComputedStyle(elements.browserStage);
    const hidden = computedStyle.display === "none"
        || rect.width < 1
        || rect.height < 1;
    const viewport = hidden ? rect : computeReaderViewport(rect);
    window.stickyDesktop?.setReaderBounds(hidden
        ? { x: 0, y: 0, width: 0, height: 0 }
        : viewport);
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
