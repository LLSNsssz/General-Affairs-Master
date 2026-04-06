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
  onWindowState(listener: (value: WindowStateSnapshot) => void): () => void;
  onShortcutCommand(listener: (value: ShortcutCommand) => void): () => void;
}

declare global {
  interface Window {
    stickyDesktop?: StickyDesktopApi;
  }
}

export {};
