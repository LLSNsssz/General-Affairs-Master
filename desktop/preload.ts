import { contextBridge, ipcRenderer, type IpcRendererEvent, type Rectangle } from "electron";
import packageJson from "./package.json";
import type { ShortcutCommand, StickyDesktopApi, WindowStateSnapshot } from "./types/sticky-desktop";

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
  onWindowState(listener: (value: WindowStateSnapshot) => void): () => void {
    const handler = (_event: IpcRendererEvent, value: WindowStateSnapshot) => listener(value);
    ipcRenderer.on("window:state", handler);
    return () => ipcRenderer.removeListener("window:state", handler);
  },
  onShortcutCommand(listener: (value: ShortcutCommand) => void): () => void {
    const handler = (_event: IpcRendererEvent, value: ShortcutCommand) => listener(value);
    ipcRenderer.on("shortcut:command", handler);
    return () => ipcRenderer.removeListener("shortcut:command", handler);
  }
};

contextBridge.exposeInMainWorld("stickyDesktop", stickyDesktopApi);
