declare global {
  interface RendererReaderController {
    isAttached(): boolean;
    addEventListener(type: string, listener: (event: any) => void): void;
    setSource(url: string): void;
    setVisible(visible: boolean): void;
    reload(): void;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
    getURL(): string;
    getTitle(): string;
    insertCSS(css: string): Promise<string | null>;
    removeInsertedCSS(key: string): Promise<void>;
    executeJavaScript<T = unknown>(code: string, userGesture?: boolean): Promise<T | null>;
  }

  interface RendererElements {
    bookmarkList?: HTMLElement | null;
    bookmarkForm?: HTMLFormElement | null;
    bookmarkName?: HTMLInputElement | null;
    bookmarkUrl?: HTMLInputElement | null;
    recentList?: HTMLElement | null;
    addressForm?: HTMLFormElement | null;
    addressInput?: HTMLInputElement | null;
    browserStage?: HTMLElement | null;
    titleHitArea?: HTMLElement | null;
    toggleHelpButton?: HTMLButtonElement | null;
    helpPopup?: HTMLElement | null;
    closeHelpButton?: HTMLButtonElement | null;
    siteHelpList?: HTMLElement | null;
    closeWindowButton?: HTMLButtonElement | null;
    minimizeWindowButton?: HTMLButtonElement | null;
    maximizeWindowButton?: HTMLButtonElement | null;
    backButton?: HTMLButtonElement | null;
    forwardButton?: HTMLButtonElement | null;
    reloadButton?: HTMLButtonElement | null;
    toggleSimplifyButton?: HTMLButtonElement | null;
    toggleBookmarksButton?: HTMLButtonElement | null;
    toggleHistoryButton?: HTMLButtonElement | null;
    toggleSettingsButton?: HTMLButtonElement | null;
    statusText?: HTMLElement | null;
    pageTitle?: HTMLElement | null;
    stagePlaceholder?: HTMLElement | null;
    stageCover?: HTMLElement | null;
    stagePlaceholderEyebrow?: HTMLElement | null;
    stagePlaceholderTitle?: HTMLElement | null;
    stagePlaceholderBody?: HTMLElement | null;
    readerStageHost?: HTMLElement | null;
    siteSwitchToast?: HTMLElement | null;
    bookmarkDrawer?: HTMLElement | null;
    recentDrawer?: HTMLElement | null;
    settingsDrawer?: HTMLElement | null;
    fontSize?: HTMLInputElement | null;
    fontSizeValue?: HTMLOutputElement | null;
    lineHeight?: HTMLInputElement | null;
    lineHeightValue?: HTMLOutputElement | null;
  }
}

export {};
