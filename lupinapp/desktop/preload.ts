import { contextBridge, ipcRenderer, type IpcRendererEvent, type Rectangle } from "electron";
import packageJson from "./package.json";
import type {
  ReaderBoundsPayload,
  ReaderEventPayload,
  ShortcutCommand,
  StickyDesktopApi,
  WindowStateSnapshot
} from "./types/sticky-desktop";

const stickyDesktopApi: StickyDesktopApi = {
  platform: process.platform,
  appVersion: packageJson.version,
  minimizeWindow() {
    ipcRenderer.send("window:minimize");
  },
  toggleMaximizeWindow() {
    ipcRenderer.send("window:toggle-maximize");
  },
  closeWindow() {
    ipcRenderer.send("window:close");
  },
  async toggleCollapsedWindow(): Promise<WindowStateSnapshot> {
    return ipcRenderer.invoke("window:toggle-collapsed");
  },
  async toggleAlwaysOnTopWindow(): Promise<WindowStateSnapshot> {
    return ipcRenderer.invoke("window:toggle-always-on-top");
  },
  async getWindowState(): Promise<WindowStateSnapshot> {
    return ipcRenderer.invoke("window:get-state");
  },
  async getWindowBounds(): Promise<Rectangle> {
    return ipcRenderer.invoke("window:get-bounds");
  },
  setWindowPosition(x: number, y: number): void {
    ipcRenderer.send("window:set-position", { x, y });
  },
  async snapWindowPosition(x: number, y: number): Promise<Rectangle | null> {
    return ipcRenderer.invoke("window:snap-position", { x, y });
  },
  setReaderBounds(bounds: ReaderBoundsPayload): void {
    ipcRenderer.send("reader:set-bounds", bounds);
  },
  setReaderVisible(visible: boolean): void {
    ipcRenderer.send("reader:set-visible", Boolean(visible));
  },
  navigateReader(url: string): void {
    ipcRenderer.send("reader:navigate", url);
  },
  reloadReader(): void {
    ipcRenderer.send("reader:reload");
  },
  goBackReader(): void {
    ipcRenderer.send("reader:go-back");
  },
  goForwardReader(): void {
    ipcRenderer.send("reader:go-forward");
  },
  async toggleReaderDevTools(): Promise<boolean> {
    return ipcRenderer.invoke("reader:toggle-devtools");
  },
  async insertReaderCSS(css: string): Promise<string | null> {
    return ipcRenderer.invoke("reader:insert-css", css);
  },
  async removeReaderCSS(key: string): Promise<void> {
    await ipcRenderer.invoke("reader:remove-inserted-css", key);
  },
  async executeReaderJavaScript<T = unknown>(code: string, userGesture?: boolean): Promise<T | null> {
    return ipcRenderer.invoke("reader:execute-javascript", code, Boolean(userGesture));
  },
  onWindowState(listener: (value: WindowStateSnapshot) => void): () => void {
    const handler = (_event: IpcRendererEvent, value: WindowStateSnapshot) => listener(value);
    ipcRenderer.on("window:state", handler);
    return () => ipcRenderer.removeListener("window:state", handler);
  },
  onShortcutCommand(listener: (value: ShortcutCommand) => void): () => void {
    const handler = (_event: IpcRendererEvent, value: ShortcutCommand) => listener(value);
    ipcRenderer.on("shortcut:command", handler);
    return () => ipcRenderer.removeListener("shortcut:command", handler);
  },
  onReaderEvent(listener: (value: ReaderEventPayload) => void): () => void {
    const handler = (_event: IpcRendererEvent, value: ReaderEventPayload) => listener(value);
    ipcRenderer.on("reader:event", handler);
    return () => ipcRenderer.removeListener("reader:event", handler);
  }
};

contextBridge.exposeInMainWorld("stickyDesktop", stickyDesktopApi);
