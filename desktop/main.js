"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const electron_1 = require("electron");
const DEFAULT_WINDOW_WIDTH = 700;
const DEFAULT_WINDOW_HEIGHT = 480;
const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 240;
const COLLAPSED_HEIGHT = 24;
const WINDOW_SNAP_THRESHOLD = 18;
const WINDOW_SNAP_CACHE_MS = 350;
const READER_PARTITION = "persist:sticky-lupin-reader";
const APP_ROOT = __dirname;
const APP_ICON_PATH = node_path_1.default.join(APP_ROOT, "assets", "sticky-lupin.ico");
const PORTABLE_RUNTIME_DIRNAME = "StickyLupinReader-data";
const IS_RELEASE_VERIFY = process.argv.includes("--release-verify") || process.env.STICKY_RELEASE_VERIFY === "1";
const WINDOW_SHORTCUTS = [
    { accelerator: "CommandOrControl+1", command: { type: "switch-site", index: 0 } },
    { accelerator: "CommandOrControl+2", command: { type: "switch-site", index: 1 } },
    { accelerator: "CommandOrControl+3", command: { type: "switch-site", index: 2 } },
    { accelerator: "CommandOrControl+4", command: { type: "switch-site", index: 3 } },
    { accelerator: "CommandOrControl+Shift+1", command: { type: "open-site-login", index: 0 } },
    { accelerator: "CommandOrControl+Shift+2", command: { type: "open-site-login", index: 1 } },
    { accelerator: "CommandOrControl+Shift+3", command: { type: "open-site-login", index: 2 } },
    { accelerator: "CommandOrControl+Shift+4", command: { type: "open-site-login", index: 3 } },
    { accelerator: "CommandOrControl+L", command: { type: "open-current-login" } },
    { accelerator: "Alt+Left", command: { type: "go-back" } },
    { accelerator: "CommandOrControl+[", command: { type: "go-back" } },
    { accelerator: "CommandOrControl+Tab", command: { type: "cycle-site", step: 1 } },
    { accelerator: "CommandOrControl+Shift+Tab", command: { type: "cycle-site", step: -1 } }
];
const RUNTIME_ROOT = resolveRuntimeRoot();
const DEV_INSTANCE_FILE = node_path_1.default.join(RUNTIME_ROOT, "dev-instance.json");
const RELEASE_VERIFY_FILE = node_path_1.default.join(RUNTIME_ROOT, "release-verify.json");
const RUNTIME_PATHS = {
    userData: node_path_1.default.join(RUNTIME_ROOT, "user-data"),
    sessionData: node_path_1.default.join(RUNTIME_ROOT, "session-data"),
    cache: node_path_1.default.join(RUNTIME_ROOT, "cache"),
    mediaCache: node_path_1.default.join(RUNTIME_ROOT, "media-cache"),
    logs: node_path_1.default.join(RUNTIME_ROOT, "logs")
};
const SNAP_LOG_FILE = node_path_1.default.join(RUNTIME_PATHS.logs, "window-snap.log");
const READER_LOG_FILE = node_path_1.default.join(RUNTIME_PATHS.logs, "reader-events.log");
let mainWindow = null;
let visibleWindowCache = null;
const hasSingleInstanceLock = IS_RELEASE_VERIFY ? true : electron_1.app.requestSingleInstanceLock();
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
    if (IS_RELEASE_VERIFY && !electron_1.app.isPackaged) {
        return node_path_1.default.join(APP_ROOT, ".runtime-release-verify");
    }
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
function appendSnapLog(event, payload) {
    try {
        const maxBytes = 256 * 1024;
        if (node_fs_1.default.existsSync(SNAP_LOG_FILE) && node_fs_1.default.statSync(SNAP_LOG_FILE).size > maxBytes) {
            node_fs_1.default.writeFileSync(SNAP_LOG_FILE, "");
        }
        node_fs_1.default.appendFileSync(SNAP_LOG_FILE, `${JSON.stringify({ at: new Date().toISOString(), event, payload })}\n`, "utf8");
    }
    catch {
        // Ignore diagnostic logging failures.
    }
}
function appendReaderLog(event, payload) {
    try {
        const maxBytes = 256 * 1024;
        if (node_fs_1.default.existsSync(READER_LOG_FILE) && node_fs_1.default.statSync(READER_LOG_FILE).size > maxBytes) {
            node_fs_1.default.writeFileSync(READER_LOG_FILE, "");
        }
        node_fs_1.default.appendFileSync(READER_LOG_FILE, `${JSON.stringify({ at: new Date().toISOString(), event, payload })}\n`, "utf8");
    }
    catch {
        // Ignore diagnostic logging failures.
    }
}
function shouldLogReaderUrl(url) {
    return /(novelpia\.com|munpia\.com)/i.test(String(url || ""));
}
function getWindowRight(bounds) {
    return bounds.x + bounds.width;
}
function getWindowBottom(bounds) {
    return bounds.y + bounds.height;
}
function clampWindowAxis(position, size, start, end) {
    const maxPosition = Math.max(start, end - size);
    return Math.min(Math.max(position, start), maxPosition);
}
function clampBoundsToWorkArea(bounds, workArea) {
    return {
        x: clampWindowAxis(bounds.x, bounds.width, workArea.x, getWindowRight(workArea)),
        y: clampWindowAxis(bounds.y, bounds.height, workArea.y, getWindowBottom(workArea)),
        width: bounds.width,
        height: bounds.height
    };
}
function pickClosestSnapCoordinate(current, candidates) {
    let best = current;
    let bestDistance = WINDOW_SNAP_THRESHOLD + 1;
    candidates.forEach((candidate) => {
        const distance = Math.abs(candidate - current);
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    });
    return bestDistance <= WINDOW_SNAP_THRESHOLD ? best : current;
}
function rangesOverlap(startA, endA, startB, endB) {
    return Math.min(endA, endB) > Math.max(startA, startB);
}
function isLikelyStickyNotesWindow(candidate) {
    const searchable = `${candidate.processName} ${candidate.title} ${candidate.className}`.toLowerCase();
    return /sticky|note|notes|메모|스티키|microsoft\.notes/.test(searchable);
}
function isLikelySnapCandidateWindow(candidate) {
    const title = candidate.title.trim();
    const className = candidate.className.trim().toLowerCase();
    if (candidate.processId === process.pid || candidate.width < 120 || candidate.height < 80) {
        return false;
    }
    if (["shell_traywnd", "workerw", "progman"].includes(className)) {
        return false;
    }
    return Boolean(title) || isLikelyStickyNotesWindow(candidate);
}
function buildWindowEnumerationScript() {
    return `
$signature = @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class StickySnap {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowTextLengthW(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern int GetClassNameW(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
public static class StickyDwm {
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);
}
"@
Add-Type -TypeDefinition $signature
$windows = New-Object 'System.Collections.Generic.List[object]'
[StickySnap]::EnumWindows({
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  if (-not [StickySnap]::IsWindowVisible($hWnd)) { return $true }
  if ([StickySnap]::IsIconic($hWnd)) { return $true }

  $rect = New-Object StickySnap+RECT
  if (-not [StickySnap]::GetWindowRect($hWnd, [ref]$rect)) { return $true }

  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -lt 120 -or $height -lt 80) { return $true }

  $titleLength = [StickySnap]::GetWindowTextLengthW($hWnd)
  $titleBuilder = New-Object System.Text.StringBuilder ([Math]::Max($titleLength + 1, 512))
  [void][StickySnap]::GetWindowTextW($hWnd, $titleBuilder, $titleBuilder.Capacity)
  $title = $titleBuilder.ToString().Trim()

  $classBuilder = New-Object System.Text.StringBuilder 256
  [void][StickySnap]::GetClassNameW($hWnd, $classBuilder, $classBuilder.Capacity)
  $className = $classBuilder.ToString().Trim()

  $cloaked = 0
  try {
    [void][StickyDwm]::DwmGetWindowAttribute($hWnd, 14, [ref]$cloaked, 4)
  } catch {}
  if ($cloaked -ne 0) { return $true }

  [uint32]$pid = 0
  [void][StickySnap]::GetWindowThreadProcessId($hWnd, [ref]$pid)
  $processName = ""
  try {
    $processName = [System.Diagnostics.Process]::GetProcessById([int]$pid).ProcessName
  } catch {}

  if ([string]::IsNullOrWhiteSpace($title) -and [string]::IsNullOrWhiteSpace($processName)) { return $true }

  $windows.Add([pscustomobject]@{
    processId = [int]$pid
    processName = $processName
    title = $title
    className = $className
    x = $rect.Left
    y = $rect.Top
    width = $width
    height = $height
  }) | Out-Null

  return $true
}, [IntPtr]::Zero) | Out-Null

$windows | ConvertTo-Json -Compress
`;
}
async function getVisibleWindows() {
    if (process.platform !== "win32") {
        return [];
    }
    const now = Date.now();
    if (visibleWindowCache && now - visibleWindowCache.at < WINDOW_SNAP_CACHE_MS) {
        return visibleWindowCache.windows;
    }
    const command = Buffer.from(buildWindowEnumerationScript(), "utf16le").toString("base64");
    const windows = await new Promise((resolve) => {
        (0, node_child_process_1.execFile)("powershell.exe", [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-EncodedCommand",
            command
        ], { timeout: 2500, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout) => {
            if (error || !stdout?.trim()) {
                appendSnapLog("snap-window-enumeration-empty", {
                    hasError: Boolean(error),
                    message: error?.message ?? "",
                    stdout: stdout?.slice(0, 200) ?? ""
                });
                resolve([]);
                return;
            }
            try {
                const parsed = JSON.parse(stdout.trim());
                const list = Array.isArray(parsed) ? parsed : [parsed];
                const filtered = list.filter((item) => item && isLikelySnapCandidateWindow(item));
                appendSnapLog("snap-window-enumeration", {
                    total: list.length,
                    filtered: filtered.length,
                    windows: filtered.slice(0, 8).map((item) => ({
                        processName: item.processName,
                        title: item.title,
                        className: item.className,
                        x: item.x,
                        y: item.y,
                        width: item.width,
                        height: item.height
                    }))
                });
                resolve(filtered);
            }
            catch {
                appendSnapLog("snap-window-enumeration-parse-error", {
                    stdout: stdout.trim().slice(0, 500)
                });
                resolve([]);
            }
        });
    });
    visibleWindowCache = {
        at: now,
        windows
    };
    return windows;
}
async function getSnappedBounds(window, nextPosition) {
    const currentBounds = window.getBounds();
    const nextBounds = {
        x: Math.round(nextPosition.x),
        y: Math.round(nextPosition.y),
        width: currentBounds.width,
        height: currentBounds.height
    };
    const display = electron_1.screen.getDisplayMatching(nextBounds);
    const workArea = display.workArea;
    const xCandidates = [workArea.x, getWindowRight(workArea) - nextBounds.width];
    const yCandidates = [workArea.y, getWindowBottom(workArea) - nextBounds.height];
    const visibleWindows = await getVisibleWindows();
    visibleWindows.forEach((candidate) => {
        const candidateRight = getWindowRight(candidate);
        const candidateBottom = getWindowBottom(candidate);
        const verticalOverlap = rangesOverlap(nextBounds.y, getWindowBottom(nextBounds), candidate.y, candidateBottom);
        const horizontalOverlap = rangesOverlap(nextBounds.x, getWindowRight(nextBounds), candidate.x, candidateRight);
        xCandidates.push(candidate.x, candidateRight - nextBounds.width);
        yCandidates.push(candidate.y, candidateBottom - nextBounds.height);
        if (verticalOverlap) {
            xCandidates.push(candidateRight, candidate.x - nextBounds.width);
        }
        if (horizontalOverlap) {
            yCandidates.push(candidateBottom, candidate.y - nextBounds.height);
        }
    });
    return clampBoundsToWorkArea({
        x: pickClosestSnapCoordinate(nextBounds.x, xCandidates),
        y: pickClosestSnapCoordinate(nextBounds.y, yCandidates),
        width: nextBounds.width,
        height: nextBounds.height
    }, workArea);
}
function writeDevInstanceFile() {
    if (electron_1.app.isPackaged || IS_RELEASE_VERIFY) {
        return;
    }
    node_fs_1.default.writeFileSync(DEV_INSTANCE_FILE, JSON.stringify({
        pid: process.pid,
        startedAt: Date.now()
    }));
}
function removeDevInstanceFile() {
    if (electron_1.app.isPackaged || IS_RELEASE_VERIFY || !node_fs_1.default.existsSync(DEV_INSTANCE_FILE)) {
        return;
    }
    try {
        node_fs_1.default.unlinkSync(DEV_INSTANCE_FILE);
    }
    catch (error) {
        console.error(error);
    }
}
function writeReleaseVerifyFile(window) {
    if (!IS_RELEASE_VERIFY) {
        return;
    }
    node_fs_1.default.writeFileSync(RELEASE_VERIFY_FILE, JSON.stringify({
        pid: process.pid,
        verifiedAt: Date.now(),
        bounds: window.getBounds()
    }));
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
function createDefaultReaderBounds() {
    return {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };
}
function getReaderViewOrThrow(window) {
    if (!window.readerView) {
        throw new Error("No reader view");
    }
    return window.readerView;
}
function getReaderWebContentsOrThrow(window) {
    return getReaderViewOrThrow(window).webContents;
}
function canReaderGoBack(contents) {
    return contents?.navigationHistory.canGoBack() ?? false;
}
function canReaderGoForward(contents) {
    return contents?.navigationHistory.canGoForward() ?? false;
}
function isAbortedNavigationFailure(errorCode, errorDescription) {
    return errorCode === -3 || /aborted/i.test(String(errorDescription || ""));
}
function isAbortedNavigationError(error) {
    if (!error || typeof error !== "object") {
        return false;
    }
    const candidate = error;
    const message = String(candidate.message || "");
    const isReleaseVerifyFailure = IS_RELEASE_VERIFY && (candidate.code === "ERR_FAILED" || candidate.errno === -2);
    return (isReleaseVerifyFailure ||
        candidate.code === "ERR_ABORTED" ||
        candidate.errno === -3 ||
        message.includes("ERR_ABORTED") ||
        message.includes("(-3) loading"));
}
function getReaderSnapshot(window) {
    const contents = window.readerView?.webContents ?? null;
    return {
        url: contents?.getURL() ?? "",
        title: contents?.getTitle() ?? "",
        canGoBack: canReaderGoBack(contents),
        canGoForward: canReaderGoForward(contents),
        loading: Boolean(window.readerLoading)
    };
}
function sendReaderEvent(window, type, extra = {}) {
    if (window.isDestroyed()) {
        return;
    }
    const payload = {
        type,
        ...getReaderSnapshot(window),
        ...extra
    };
    if (shouldLogReaderUrl(payload.url) || type === "did-fail-load") {
        appendReaderLog(type, {
            url: payload.url,
            title: payload.title,
            loading: payload.loading,
            canGoBack: payload.canGoBack,
            canGoForward: payload.canGoForward,
            errorCode: payload.errorCode,
            errorDescription: payload.errorDescription
        });
    }
    window.webContents.send("reader:event", payload);
}
function setReaderBounds(window, bounds) {
    window.readerBounds = bounds;
    if (!window.readerView) {
        return;
    }
    const nextBounds = {
        x: Math.max(0, Math.round(bounds.x)),
        y: Math.max(0, Math.round(bounds.y)),
        width: Math.max(0, Math.round(bounds.width)),
        height: Math.max(0, Math.round(bounds.height))
    };
    window.readerView.setBounds(nextBounds);
    window.readerView.setVisible(Boolean(window.readerVisible) && nextBounds.width > 0 && nextBounds.height > 0);
}
function setReaderVisibility(window, visible) {
    window.readerVisible = visible;
    if (!window.readerView) {
        return;
    }
    const bounds = window.readerBounds ?? createDefaultReaderBounds();
    window.readerView.setVisible(visible && bounds.width > 0 && bounds.height > 0);
}
function createReaderView(window) {
    const readerView = new electron_1.WebContentsView({
        webPreferences: {
            partition: READER_PARTITION,
            preload: node_path_1.default.join(APP_ROOT, "renderer", "reader-preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            spellcheck: false
        }
    });
    window.readerView = readerView;
    window.readerLoading = false;
    window.readerBounds = createDefaultReaderBounds();
    window.readerVisible = false;
    setReaderBounds(window, window.readerBounds);
    readerView.webContents.setWindowOpenHandler(({ url }) => {
        void electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    readerView.webContents.on("dom-ready", () => {
        sendReaderEvent(window, "dom-ready");
    });
    readerView.webContents.on("did-start-loading", () => {
        window.readerLoading = true;
        sendReaderEvent(window, "did-start-loading");
    });
    readerView.webContents.on("did-stop-loading", () => {
        window.readerLoading = false;
        sendReaderEvent(window, "did-stop-loading");
    });
    readerView.webContents.on("did-navigate", () => {
        sendReaderEvent(window, "did-navigate");
    });
    readerView.webContents.on("did-navigate-in-page", (_event, _url, isMainFrame) => {
        if (!isMainFrame) {
            return;
        }
        sendReaderEvent(window, "did-navigate-in-page");
    });
    readerView.webContents.on("page-title-updated", () => {
        sendReaderEvent(window, "page-title-updated");
    });
    readerView.webContents.on("did-fail-load", (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
        if (!isMainFrame) {
            return;
        }
        if (isAbortedNavigationFailure(errorCode, errorDescription)) {
            return;
        }
        window.readerLoading = false;
        sendReaderEvent(window, "did-fail-load", { errorCode, errorDescription });
    });
    window.contentView.addChildView(readerView);
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
            spellcheck: false
        }
    }));
    createReaderView(window);
    window.loadFile(node_path_1.default.join(APP_ROOT, "renderer", "index.html"));
    window.webContents.setWindowOpenHandler(({ url }) => {
        void electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    window.stickyState = createDefaultStickyState(window);
    window.webContents.on("did-finish-load", () => {
        sendWindowState(window);
        if (IS_RELEASE_VERIFY) {
            writeReleaseVerifyFile(window);
            setTimeout(() => {
                if (!window.isDestroyed()) {
                    window.close();
                }
            }, 750);
        }
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
        window.readerView = null;
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
function isReaderBoundsPayload(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const payload = value;
    return (typeof payload.x === "number" &&
        typeof payload.y === "number" &&
        typeof payload.width === "number" &&
        typeof payload.height === "number");
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
async function handleSnapWindowPosition(event, value) {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (!window || !isWindowPositionPayload(value)) {
        appendSnapLog("snap-window-invalid-payload", { hasWindow: Boolean(window), value });
        return null;
    }
    try {
        const currentBounds = window.getBounds();
        const snappedBounds = await getSnappedBounds(window, value);
        window.setPosition(snappedBounds.x, snappedBounds.y, true);
        const finalBounds = window.getBounds();
        appendSnapLog("snap-window-position", {
            requested: value,
            currentBounds,
            snappedBounds,
            finalBounds
        });
        return finalBounds;
    }
    catch (error) {
        appendSnapLog("snap-window-error", {
            requested: value,
            message: error instanceof Error ? error.message : String(error)
        });
        return window.getBounds();
    }
}
function handleSetReaderBounds(event, value) {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (!window || !isReaderBoundsPayload(value)) {
        return;
    }
    setReaderBounds(asStickyWindow(window), value);
}
function handleSetReaderVisibility(event, value) {
    const window = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (!window || typeof value !== "boolean") {
        return;
    }
    setReaderVisibility(asStickyWindow(window), value);
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
function handleReaderNavigate(event, url) {
    if (typeof url !== "string" || !url.trim()) {
        return;
    }
    const window = getSenderWindowOrThrow(event.sender);
    if (shouldLogReaderUrl(url)) {
        appendReaderLog("navigate-request", {
            url,
            currentUrl: window.readerView?.webContents.getURL() ?? ""
        });
    }
    void getReaderWebContentsOrThrow(window).loadURL(url).catch((error) => {
        if (isAbortedNavigationError(error)) {
            if (shouldLogReaderUrl(url)) {
                appendReaderLog("navigate-aborted", {
                    url,
                    message: error instanceof Error ? error.message : String(error)
                });
            }
            return;
        }
        appendReaderLog("navigate-error", {
            url,
            message: error instanceof Error ? error.message : String(error)
        });
        console.error(error);
    });
}
function handleReaderReload(event) {
    getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender)).reload();
}
function handleReaderGoBack(event) {
    const readerContents = getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender));
    if (canReaderGoBack(readerContents)) {
        readerContents.goBack();
    }
}
function handleReaderGoForward(event) {
    const readerContents = getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender));
    if (canReaderGoForward(readerContents)) {
        readerContents.goForward();
    }
}
async function handleReaderInsertCss(event, css) {
    if (typeof css !== "string" || !css) {
        return null;
    }
    return getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender)).insertCSS(css);
}
async function handleReaderRemoveInsertedCss(event, key) {
    if (typeof key !== "string" || !key) {
        return;
    }
    await getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender)).removeInsertedCSS(key);
}
async function handleReaderExecuteJavaScript(event, code, userGesture) {
    if (typeof code !== "string" || !code) {
        return null;
    }
    return getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender)).executeJavaScript(code, Boolean(userGesture));
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
        electron_1.ipcMain.handle("window:snap-position", handleSnapWindowPosition);
        electron_1.ipcMain.on("reader:set-bounds", handleSetReaderBounds);
        electron_1.ipcMain.on("reader:set-visible", handleSetReaderVisibility);
        electron_1.ipcMain.on("reader:navigate", handleReaderNavigate);
        electron_1.ipcMain.on("reader:reload", handleReaderReload);
        electron_1.ipcMain.on("reader:go-back", handleReaderGoBack);
        electron_1.ipcMain.on("reader:go-forward", handleReaderGoForward);
        electron_1.ipcMain.handle("window:toggle-collapsed", handleToggleCollapsed);
        electron_1.ipcMain.handle("window:toggle-always-on-top", handleToggleAlwaysOnTop);
        electron_1.ipcMain.handle("window:get-state", handleGetWindowState);
        electron_1.ipcMain.handle("window:get-bounds", handleGetWindowBounds);
        electron_1.ipcMain.handle("reader:insert-css", handleReaderInsertCss);
        electron_1.ipcMain.handle("reader:remove-inserted-css", handleReaderRemoveInsertedCss);
        electron_1.ipcMain.handle("reader:execute-javascript", handleReaderExecuteJavaScript);
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
