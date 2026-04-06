import fs from "node:fs";
import path from "node:path";
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Rectangle,
  type WebContents
} from "electron";
import type { ShortcutCommand, WindowStateSnapshot } from "./types/sticky-desktop";

const DEFAULT_WINDOW_WIDTH = 700;
const DEFAULT_WINDOW_HEIGHT = 480;
const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 240;
const COLLAPSED_HEIGHT = 24;
const READER_PARTITION = "persist:sticky-lupin-reader";
const APP_ROOT = __dirname;
const APP_ICON_PATH = path.join(APP_ROOT, "assets", "sticky-lupin.ico");
const PORTABLE_RUNTIME_DIRNAME = "StickyLupinReader-data";

type StickyShortcutBinding = {
  accelerator: string;
  command: ShortcutCommand;
};

type WindowPositionPayload = {
  x: number;
  y: number;
};

type StickyWindowState = {
  collapsed: boolean;
  alwaysOnTop: boolean;
  normalBounds: Rectangle | null;
};

type StickyBrowserWindow = BrowserWindow & {
  stickyState?: StickyWindowState;
};

const WINDOW_SHORTCUTS: StickyShortcutBinding[] = [
  { accelerator: "CommandOrControl+1", command: { type: "switch-site", index: 0 } },
  { accelerator: "CommandOrControl+2", command: { type: "switch-site", index: 1 } },
  { accelerator: "CommandOrControl+3", command: { type: "switch-site", index: 2 } },
  { accelerator: "CommandOrControl+4", command: { type: "switch-site", index: 3 } },
  { accelerator: "CommandOrControl+5", command: { type: "switch-site", index: 4 } },
  { accelerator: "CommandOrControl+Shift+1", command: { type: "open-site-login", index: 0 } },
  { accelerator: "CommandOrControl+Shift+2", command: { type: "open-site-login", index: 1 } },
  { accelerator: "CommandOrControl+Shift+3", command: { type: "open-site-login", index: 2 } },
  { accelerator: "CommandOrControl+Shift+4", command: { type: "open-site-login", index: 3 } },
  { accelerator: "CommandOrControl+Shift+5", command: { type: "open-site-login", index: 4 } },
  { accelerator: "CommandOrControl+L", command: { type: "open-current-login" } },
  { accelerator: "Alt+Left", command: { type: "go-back" } },
  { accelerator: "CommandOrControl+[", command: { type: "go-back" } },
  { accelerator: "CommandOrControl+Tab", command: { type: "cycle-site", step: 1 } },
  { accelerator: "CommandOrControl+Shift+Tab", command: { type: "cycle-site", step: -1 } }
];

const RUNTIME_ROOT = resolveRuntimeRoot();
const DEV_INSTANCE_FILE = path.join(RUNTIME_ROOT, "dev-instance.json");
const RUNTIME_PATHS = {
  userData: path.join(RUNTIME_ROOT, "user-data"),
  sessionData: path.join(RUNTIME_ROOT, "session-data"),
  cache: path.join(RUNTIME_ROOT, "cache"),
  mediaCache: path.join(RUNTIME_ROOT, "media-cache"),
  logs: path.join(RUNTIME_ROOT, "logs")
} as const;

let mainWindow: StickyBrowserWindow | null = null;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

prepareRuntimePaths();

app.setPath("userData", RUNTIME_PATHS.userData);
app.setPath("sessionData", RUNTIME_PATHS.sessionData);
app.setPath("logs", RUNTIME_PATHS.logs);
app.commandLine.appendSwitch("disk-cache-dir", RUNTIME_PATHS.cache);
app.commandLine.appendSwitch("media-cache-dir", RUNTIME_PATHS.mediaCache);

function resolveRuntimeRoot(): string {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) {
    return path.join(portableDir, PORTABLE_RUNTIME_DIRNAME);
  }

  if (app.isPackaged) {
    return path.join(app.getPath("appData"), "StickyLupinReader");
  }

  return path.join(APP_ROOT, ".runtime");
}

function prepareRuntimePaths(): void {
  fs.mkdirSync(RUNTIME_ROOT, { recursive: true });
  Object.values(RUNTIME_PATHS).forEach((targetPath) => {
    fs.mkdirSync(targetPath, { recursive: true });
  });
}

function writeDevInstanceFile(): void {
  if (app.isPackaged) {
    return;
  }

  fs.writeFileSync(
    DEV_INSTANCE_FILE,
    JSON.stringify({
      pid: process.pid,
      startedAt: Date.now()
    })
  );
}

function removeDevInstanceFile(): void {
  if (app.isPackaged || !fs.existsSync(DEV_INSTANCE_FILE)) {
    return;
  }

  try {
    fs.unlinkSync(DEV_INSTANCE_FILE);
  } catch (error) {
    console.error(error);
  }
}

function asStickyWindow(window: BrowserWindow): StickyBrowserWindow {
  return window as StickyBrowserWindow;
}

function createDefaultStickyState(window: BrowserWindow): StickyWindowState {
  return {
    collapsed: false,
    alwaysOnTop: window.isAlwaysOnTop(),
    normalBounds: null
  };
}

function createWindow(): StickyBrowserWindow {
  const window = asStickyWindow(
    new BrowserWindow({
      width: DEFAULT_WINDOW_WIDTH,
      height: DEFAULT_WINDOW_HEIGHT,
      minWidth: MIN_WINDOW_WIDTH,
      minHeight: MIN_WINDOW_HEIGHT,
      autoHideMenuBar: true,
      frame: false,
      titleBarStyle: "hidden",
      maximizable: false,
      fullscreenable: false,
      backgroundColor: "#f6efb6",
      icon: APP_ICON_PATH,
      roundedCorners: true,
      title: "Sticky Lupin Desktop",
      webPreferences: {
        preload: path.join(APP_ROOT, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webviewTag: true,
        spellcheck: false
      }
    })
  );

  window.loadFile(path.join(APP_ROOT, "renderer", "index.html"));

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.stickyState = createDefaultStickyState(window);

  window.webContents.on("did-finish-load", () => {
    sendWindowState(window);
  });

  window.on("focus", () => {
    registerWindowShortcuts(window);
  });

  window.on("blur", () => {
    unregisterWindowShortcuts();
  });

  window.on("close", () => {
    unregisterWindowShortcuts();
    flushReaderSession();
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  mainWindow = window;
  return window;
}

function getSenderWindowOrThrow(sender: WebContents): StickyBrowserWindow {
  const window = BrowserWindow.fromWebContents(sender);
  if (!window) {
    throw new Error("No sender window");
  }

  return asStickyWindow(window);
}

function sendWindowState(window: StickyBrowserWindow): void {
  const payload: WindowStateSnapshot = {
    collapsed: Boolean(window.stickyState?.collapsed),
    alwaysOnTop: Boolean(window.isAlwaysOnTop())
  };

  window.webContents.send("window:state", payload);
}

function toggleCollapsed(window: StickyBrowserWindow): WindowStateSnapshot {
  if (!window.stickyState) {
    window.stickyState = createDefaultStickyState(window);
  }

  if (!window.stickyState.collapsed) {
    if (window.isMaximized()) {
      window.unmaximize();
    }

    window.stickyState.normalBounds = window.getBounds();
    window.stickyState.collapsed = true;
    window.setResizable(false);
    window.setMinimumSize(320, COLLAPSED_HEIGHT);

    const { x, y, width } = window.stickyState.normalBounds;
    window.setBounds({ x, y, width, height: COLLAPSED_HEIGHT }, true);
    sendWindowState(window);
    return { collapsed: true, alwaysOnTop: window.isAlwaysOnTop() };
  }

  const fallbackBounds: Rectangle = {
    x: window.getBounds().x,
    y: window.getBounds().y,
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT
  };

  const nextBounds = window.stickyState.normalBounds ?? fallbackBounds;
  window.stickyState.collapsed = false;
  window.setResizable(true);
  window.setMinimumSize(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT);
  window.setBounds(nextBounds, true);
  sendWindowState(window);
  return { collapsed: false, alwaysOnTop: window.isAlwaysOnTop() };
}

function toggleAlwaysOnTop(window: StickyBrowserWindow): WindowStateSnapshot {
  const nextValue = !window.isAlwaysOnTop();
  window.setAlwaysOnTop(nextValue, nextValue ? "floating" : "normal");
  sendWindowState(window);
  return { collapsed: Boolean(window.stickyState?.collapsed), alwaysOnTop: nextValue };
}

function registerWindowShortcuts(window: StickyBrowserWindow): void {
  unregisterWindowShortcuts();

  WINDOW_SHORTCUTS.forEach(({ accelerator, command }) => {
    globalShortcut.register(accelerator, () => {
      if (!window || window.isDestroyed()) {
        return;
      }

      window.webContents.send("shortcut:command", command);
    });
  });
}

function unregisterWindowShortcuts(): void {
  WINDOW_SHORTCUTS.forEach(({ accelerator }) => {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
  });
}

function flushReaderSession(): void {
  try {
    const readerSession = session.fromPartition(READER_PARTITION);
    void readerSession.flushStorageData();
    void readerSession.cookies.flushStore();
  } catch (error) {
    console.error(error);
  }
}

function isWindowPositionPayload(value: unknown): value is WindowPositionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<WindowPositionPayload>;
  return typeof payload.x === "number" && typeof payload.y === "number";
}

function handleMinimizeWindow(event: IpcMainEvent): void {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.minimize();
  }
}

function handleToggleMaximize(event: IpcMainEvent): void {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) {
    return;
  }

  if (window.isMaximized()) {
    window.unmaximize();
    return;
  }

  window.maximize();
}

function handleCloseWindow(event: IpcMainEvent): void {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.close();
  }
}

function handleSetWindowPosition(event: IpcMainEvent, value: unknown): void {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !isWindowPositionPayload(value)) {
    return;
  }

  window.setPosition(Math.round(value.x), Math.round(value.y), true);
}

function handleToggleCollapsed(event: IpcMainInvokeEvent): WindowStateSnapshot {
  return toggleCollapsed(getSenderWindowOrThrow(event.sender));
}

function handleToggleAlwaysOnTop(event: IpcMainInvokeEvent): WindowStateSnapshot {
  return toggleAlwaysOnTop(getSenderWindowOrThrow(event.sender));
}

function handleGetWindowState(event: IpcMainInvokeEvent): WindowStateSnapshot {
  const window = getSenderWindowOrThrow(event.sender);
  return {
    collapsed: Boolean(window.stickyState?.collapsed),
    alwaysOnTop: Boolean(window.isAlwaysOnTop())
  };
}

function handleGetWindowBounds(event: IpcMainInvokeEvent): Rectangle {
  return getSenderWindowOrThrow(event.sender).getBounds();
}

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
    ipcMain.on("window:minimize", handleMinimizeWindow);
    ipcMain.on("window:toggle-maximize", handleToggleMaximize);
    ipcMain.on("window:close", handleCloseWindow);
    ipcMain.on("window:set-position", handleSetWindowPosition);
    ipcMain.handle("window:toggle-collapsed", handleToggleCollapsed);
    ipcMain.handle("window:toggle-always-on-top", handleToggleAlwaysOnTop);
    ipcMain.handle("window:get-state", handleGetWindowState);
    ipcMain.handle("window:get-bounds", handleGetWindowBounds);

    createWindow();
    writeDevInstanceFile();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("before-quit", () => {
  removeDevInstanceFile();
  unregisterWindowShortcuts();
  flushReaderSession();
});

app.on("window-all-closed", () => {
  removeDevInstanceFile();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
