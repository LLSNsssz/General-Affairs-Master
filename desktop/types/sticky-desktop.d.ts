import type { Rectangle } from "electron";

export type ShortcutCommand =
  | { type: "switch-site"; index: number }
  | { type: "open-site-login"; index: number }
  | { type: "open-current-login" }
  | { type: "go-back" }
  | { type: "cycle-site"; step: number };

export interface WindowStateSnapshot {
  collapsed: boolean;
  alwaysOnTop: boolean;
}

export interface ReaderBoundsPayload {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReaderEventPayload {
  type:
    | "dom-ready"
    | "did-start-loading"
    | "did-stop-loading"
    | "did-navigate"
    | "did-navigate-in-page"
    | "page-title-updated"
    | "did-fail-load";
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  errorCode?: number;
  errorDescription?: string;
}

export interface StickyDesktopApi {
  platform: NodeJS.Platform;
  appVersion: string;
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
  toggleCollapsedWindow(): Promise<WindowStateSnapshot>;
  toggleAlwaysOnTopWindow(): Promise<WindowStateSnapshot>;
  getWindowState(): Promise<WindowStateSnapshot>;
  getWindowBounds(): Promise<Rectangle>;
  setWindowPosition(x: number, y: number): void;
  snapWindowPosition(x: number, y: number): Promise<Rectangle | null>;
  setReaderBounds(bounds: ReaderBoundsPayload): void;
  setReaderVisible(visible: boolean): void;
  navigateReader(url: string): void;
  reloadReader(): void;
  goBackReader(): void;
  goForwardReader(): void;
  insertReaderCSS(css: string): Promise<string | null>;
  removeReaderCSS(key: string): Promise<void>;
  executeReaderJavaScript<T = unknown>(code: string, userGesture?: boolean): Promise<T | null>;
  onWindowState(listener: (value: WindowStateSnapshot) => void): () => void;
  onShortcutCommand(listener: (value: ShortcutCommand) => void): () => void;
  onReaderEvent(listener: (value: ReaderEventPayload) => void): () => void;
}

declare global {
  interface Window {
    stickyDesktop?: StickyDesktopApi;
  }
}

export {};
