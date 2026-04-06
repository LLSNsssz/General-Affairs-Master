"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const DEFAULT_WINDOW_WIDTH = 700;
const DEFAULT_WINDOW_HEIGHT = 480;
const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 240;
const COLLAPSED_HEIGHT = 24;
const READER_PARTITION = "persist:sticky-lupin-reader";
const APP_ROOT = __dirname;
const APP_ICON_PATH = node_path_1.default.join(APP_ROOT, "assets", "sticky-lupin.ico");
const PORTABLE_RUNTIME_DIRNAME = "StickyLupinReader-data";
const WINDOW_SHORTCUTS = [
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
const DEV_INSTANCE_FILE = node_path_1.default.join(RUNTIME_ROOT, "dev-instance.json");
const RUNTIME_PATHS = {
    userData: node_path_1.default.join(RUNTIME_ROOT, "user-data"),
    sessionData: node_path_1.default.join(RUNTIME_ROOT, "session-data"),
    cache: node_path_1.default.join(RUNTIME_ROOT, "cache"),
    mediaCache: node_path_1.default.join(RUNTIME_ROOT, "media-cache"),
    logs: node_path_1.default.join(RUNTIME_ROOT, "logs")
};
let mainWindow = null;
const hasSingleInstanceLock = electron_1.app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
    electron_1.app.quit();
}
prepareRuntimePaths();
electron_1.app.setPath("userData", RUNTIME_PATHS.userData);
electron_1.app.setPath("sessionData", RUNTIME_PATHS.sessionData);
electron_1.app.setPath("logs", RUNTIME_PATHS.logs);
electron_1.app.commandLine.appendSwitch("disk-cache-dir", RUNTIME_PATHS.cache);
electron_1.app.commandLine.appendSwitch("media-cache-dir", RUNTIME_PATHS.mediaCache);
function resolveRuntimeRoot() {
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
    if (portableDir) {
        return node_path_1.default.join(portableDir, PORTABLE_RUNTIME_DIRNAME);
    }
    if (electron_1.app.isPackaged) {
        return node_path_1.default.join(electron_1.app.getPath("appData"), "StickyLupinReader");
    }
    return node_path_1.default.join(APP_ROOT, ".runtime");
}
function prepareRuntimePaths() {
    node_fs_1.default.mkdirSync(RUNTIME_ROOT, { recursive: true });
    Object.values(RUNTIME_PATHS).forEach((targetPath) => {
        node_fs_1.default.mkdirSync(targetPath, { recursive: true });
    });
}
function writeDevInstanceFile() {
    if (electron_1.app.isPackaged) {
        return;
    }
    node_fs_1.default.writeFileSync(DEV_INSTANCE_FILE, JSON.stringify({
        pid: process.pid,
        startedAt: Date.now()
    }));
}
function removeDevInstanceFile() {
    if (electron_1.app.isPackaged || !node_fs_1.default.existsSync(DEV_INSTANCE_FILE)) {
        return;
    }
    try {
        node_fs_1.default.unlinkSync(DEV_INSTANCE_FILE);
    }
    catch (error) {
        console.error(error);
    }
}
function asStickyWindow(window) {
    return window;
}
function createDefaultStickyState(window) {
    return {
        collapsed: false,
        alwaysOnTop: window.isAlwaysOnTop(),
        normalBounds: null
    };
}
function createWindow() {
    const window = asStickyWindow(new electron_1.BrowserWindow({
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
            preload: node_path_1.default.join(APP_ROOT, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webviewTag: true,
            spellcheck: false
        }
    }));
    window.loadFile(node_path_1.default.join(APP_ROOT, "renderer", "index.html"));
    window.webContents.setWindowOpenHandler(({ url }) => {
        void electron_1.shell.openExternal(url);
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
function getSenderWindowOrThrow(sender) {
    const window = electron_1.BrowserWindow.fromWebContents(sender);
    if (!window) {
        throw new Error("No sender window");
    }
    return asStickyWindow(window);
}
function sendWindowState(window) {
    const payload = {
        collapsed: Boolean(window.stickyState?.collapsed),
        alwaysOnTop: Boolean(window.isAlwaysOnTop())
    };
    window.webContents.send("window:state", payload);
}
function toggleCollapsed(window) {
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
    const fallbackBounds = {
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
function toggleAlwaysOnTop(window) {
    const nextValue = !window.isAlwaysOnTop();
    window.setAlwaysOnTop(nextValue, nextValue ? "floating" : "normal");
    sendWindowState(window);
    return { collapsed: Boolean(window.stickyState?.collapsed), alwaysOnTop: nextValue };
}
function registerWindowShortcuts(window) {
    unregisterWindowShortcuts();
    WINDOW_SHORTCUTS.forEach(({ accelerator, command }) => {
        electron_1.globalShortcut.register(accelerator, () => {
            if (!window || window.isDestroyed()) {
                return;
            }
            window.webContents.send("shortcut:command", command);
        });
    });
}
function unregisterWindowShortcuts() {
    WINDOW_SHORTCUTS.forEach(({ accelerator }) => {
        if (electron_1.globalShortcut.isRegistered(accelerator)) {
            electron_1.globalShortcut.unregister(accelerator);
        }
    });
}
function flushReaderSession() {
    try {
        const readerSession = electron_1.session.fromPartition(READER_PARTITION);
        void readerSession.flushStorageData();
        void readerSession.cookies.flushStore();
    }
    catch (error) {
        console.error(error);
    }
}
function isWindowPositionPayload(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const payload = value;
    return typeof payload.x === "number" && typeof payload.y === "number";
}
function handleMinimizeWindow(event) {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.minimize();
    }
}
function handleToggleMaximize(event) {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (!window) {
        return;
    }
    if (window.isMaximized()) {
        window.unmaximize();
        return;
    }
    window.maximize();
}
function handleCloseWindow(event) {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.close();
    }
}
function handleSetWindowPosition(event, value) {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (!window || !isWindowPositionPayload(value)) {
        return;
    }
    window.setPosition(Math.round(value.x), Math.round(value.y), true);
}
function handleToggleCollapsed(event) {
    return toggleCollapsed(getSenderWindowOrThrow(event.sender));
}
function handleToggleAlwaysOnTop(event) {
    return toggleAlwaysOnTop(getSenderWindowOrThrow(event.sender));
}
function handleGetWindowState(event) {
    const window = getSenderWindowOrThrow(event.sender);
    return {
        collapsed: Boolean(window.stickyState?.collapsed),
        alwaysOnTop: Boolean(window.isAlwaysOnTop())
    };
}
function handleGetWindowBounds(event) {
    return getSenderWindowOrThrow(event.sender).getBounds();
}
if (hasSingleInstanceLock) {
    electron_1.app.on("second-instance", () => {
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
    electron_1.app.whenReady().then(() => {
        electron_1.ipcMain.on("window:minimize", handleMinimizeWindow);
        electron_1.ipcMain.on("window:toggle-maximize", handleToggleMaximize);
        electron_1.ipcMain.on("window:close", handleCloseWindow);
        electron_1.ipcMain.on("window:set-position", handleSetWindowPosition);
        electron_1.ipcMain.handle("window:toggle-collapsed", handleToggleCollapsed);
        electron_1.ipcMain.handle("window:toggle-always-on-top", handleToggleAlwaysOnTop);
        electron_1.ipcMain.handle("window:get-state", handleGetWindowState);
        electron_1.ipcMain.handle("window:get-bounds", handleGetWindowBounds);
        createWindow();
        writeDevInstanceFile();
        electron_1.app.on("activate", () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
}
electron_1.app.on("before-quit", () => {
    removeDevInstanceFile();
    unregisterWindowShortcuts();
    flushReaderSession();
});
electron_1.app.on("window-all-closed", () => {
    removeDevInstanceFile();
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
