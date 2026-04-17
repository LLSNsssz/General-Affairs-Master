import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  session,
  shell,
  WebContentsView,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Rectangle,
  type WebContents
} from "electron";
import type {
  ReaderBoundsPayload,
  ReaderEventPayload,
  ShortcutCommand,
  WindowStateSnapshot
} from "./types/sticky-desktop";

const DEFAULT_WINDOW_WIDTH = 700;
const DEFAULT_WINDOW_HEIGHT = 480;
const MIN_WINDOW_WIDTH = 360;
const MIN_WINDOW_HEIGHT = 240;
const COLLAPSED_HEIGHT = 24;
const WINDOW_SNAP_THRESHOLD = 18;
const WINDOW_SNAP_CACHE_MS = 350;
const READER_PARTITION = "persist:sticky-lupin-reader";
const APP_ROOT = __dirname;
const APP_ICON_PATH = path.join(APP_ROOT, "assets", "sticky-lupin.ico");
const PORTABLE_RUNTIME_DIRNAME = "StickyLupinReader-data";
const IS_RELEASE_VERIFY = process.argv.includes("--release-verify") || process.env.STICKY_RELEASE_VERIFY === "1";

type StickyShortcutBinding = {
  accelerator: string;
  command: ShortcutCommand;
};

type WindowPositionPayload = {
  x: number;
  y: number;
};

type VisibleWindowSnapshot = Rectangle & {
  processId: number;
  processName: string;
  title: string;
  className: string;
};

type StickyWindowState = {
  collapsed: boolean;
  alwaysOnTop: boolean;
  normalBounds: Rectangle | null;
};

type StickyBrowserWindow = BrowserWindow & {
  stickyState?: StickyWindowState;
  readerView?: WebContentsView | null;
  readerLoading?: boolean;
  readerBounds?: Rectangle | null;
  readerVisible?: boolean;
};

type ReaderEventType = ReaderEventPayload["type"];

const WINDOW_SHORTCUTS: StickyShortcutBinding[] = [
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
  { accelerator: "CommandOrControl+Shift+Tab", command: { type: "cycle-site", step: -1 } },
  { accelerator: "CommandOrControl+Alt+Left", command: { type: "open-previous-episode" } },
  { accelerator: "CommandOrControl+Alt+Right", command: { type: "open-next-episode" } },
  { accelerator: "CommandOrControl+Alt+L", command: { type: "open-episode-list" } },
  { accelerator: "CommandOrControl+Alt+C", command: { type: "open-episode-comments" } },
  { accelerator: "CommandOrControl+Alt+R", command: { type: "open-site-recent" } },
  { accelerator: "CommandOrControl+Alt+D", command: { type: "toggle-reader-devtools" } }
];

const RUNTIME_ROOT = resolveRuntimeRoot();
const DEV_INSTANCE_FILE = path.join(RUNTIME_ROOT, "dev-instance.json");
const RELEASE_VERIFY_FILE = path.join(RUNTIME_ROOT, "release-verify.json");
const RUNTIME_PATHS = {
  userData: path.join(RUNTIME_ROOT, "user-data"),
  sessionData: path.join(RUNTIME_ROOT, "session-data"),
  cache: path.join(RUNTIME_ROOT, "cache"),
  mediaCache: path.join(RUNTIME_ROOT, "media-cache"),
  logs: path.join(RUNTIME_ROOT, "logs")
} as const;
const SNAP_LOG_FILE = path.join(RUNTIME_PATHS.logs, "window-snap.log");
const READER_LOG_FILE = path.join(RUNTIME_PATHS.logs, "reader-events.log");

let mainWindow: StickyBrowserWindow | null = null;
let visibleWindowCache: {
  at: number;
  windows: VisibleWindowSnapshot[];
} | null = null;
const hasSingleInstanceLock = IS_RELEASE_VERIFY ? true : app.requestSingleInstanceLock();

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
  if (IS_RELEASE_VERIFY && !app.isPackaged) {
    return path.join(APP_ROOT, ".runtime-release-verify");
  }

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

function appendSnapLog(event: string, payload: unknown): void {
  try {
    const maxBytes = 256 * 1024;
    if (fs.existsSync(SNAP_LOG_FILE) && fs.statSync(SNAP_LOG_FILE).size > maxBytes) {
      fs.writeFileSync(SNAP_LOG_FILE, "");
    }

    fs.appendFileSync(
      SNAP_LOG_FILE,
      `${JSON.stringify({ at: new Date().toISOString(), event, payload })}\n`,
      "utf8"
    );
  } catch {
    // Ignore diagnostic logging failures.
  }
}

function appendReaderLog(event: string, payload: unknown): void {
  try {
    const maxBytes = 256 * 1024;
    if (fs.existsSync(READER_LOG_FILE) && fs.statSync(READER_LOG_FILE).size > maxBytes) {
      fs.writeFileSync(READER_LOG_FILE, "");
    }

    fs.appendFileSync(
      READER_LOG_FILE,
      `${JSON.stringify({ at: new Date().toISOString(), event, payload })}\n`,
      "utf8"
    );
  } catch {
    // Ignore diagnostic logging failures.
  }
}

function shouldLogReaderUrl(url: string): boolean {
  return /(novelpia\.com|munpia\.com)/i.test(String(url || ""));
}

function getWindowRight(bounds: Rectangle): number {
  return bounds.x + bounds.width;
}

function getWindowBottom(bounds: Rectangle): number {
  return bounds.y + bounds.height;
}

function clampWindowAxis(position: number, size: number, start: number, end: number): number {
  const maxPosition = Math.max(start, end - size);
  return Math.min(Math.max(position, start), maxPosition);
}

function clampBoundsToWorkArea(bounds: Rectangle, workArea: Rectangle): Rectangle {
  return {
    x: clampWindowAxis(bounds.x, bounds.width, workArea.x, getWindowRight(workArea)),
    y: clampWindowAxis(bounds.y, bounds.height, workArea.y, getWindowBottom(workArea)),
    width: bounds.width,
    height: bounds.height
  };
}

function pickClosestSnapCoordinate(current: number, candidates: number[]): number {
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

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.min(endA, endB) > Math.max(startA, startB);
}

function isLikelyStickyNotesWindow(candidate: VisibleWindowSnapshot): boolean {
  const searchable = `${candidate.processName} ${candidate.title} ${candidate.className}`.toLowerCase();
  return /sticky|note|notes|메모|스티키|microsoft\.notes/.test(searchable);
}

function isLikelySnapCandidateWindow(candidate: VisibleWindowSnapshot): boolean {
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

function buildWindowEnumerationScript(): string {
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

async function getVisibleWindows(): Promise<VisibleWindowSnapshot[]> {
  if (process.platform !== "win32") {
    return [];
  }

  const now = Date.now();
  if (visibleWindowCache && now - visibleWindowCache.at < WINDOW_SNAP_CACHE_MS) {
    return visibleWindowCache.windows;
  }

  const command = Buffer.from(buildWindowEnumerationScript(), "utf16le").toString("base64");
  const windows = await new Promise<VisibleWindowSnapshot[]>((resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        command
      ],
      { timeout: 2500, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
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
          const parsed = JSON.parse(stdout.trim()) as VisibleWindowSnapshot | VisibleWindowSnapshot[];
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
        } catch {
          appendSnapLog("snap-window-enumeration-parse-error", {
            stdout: stdout.trim().slice(0, 500)
          });
          resolve([]);
        }
      }
    );
  });

  visibleWindowCache = {
    at: now,
    windows
  };
  return windows;
}

async function getSnappedBounds(window: BrowserWindow, nextPosition: WindowPositionPayload): Promise<Rectangle> {
  const currentBounds = window.getBounds();
  const nextBounds: Rectangle = {
    x: Math.round(nextPosition.x),
    y: Math.round(nextPosition.y),
    width: currentBounds.width,
    height: currentBounds.height
  };

  const display = screen.getDisplayMatching(nextBounds);
  const workArea = display.workArea;
  const xCandidates = [workArea.x, getWindowRight(workArea) - nextBounds.width];
  const yCandidates = [workArea.y, getWindowBottom(workArea) - nextBounds.height];

  const visibleWindows = await getVisibleWindows();
  visibleWindows.forEach((candidate) => {
    const candidateRight = getWindowRight(candidate);
    const candidateBottom = getWindowBottom(candidate);
    const verticalOverlap = rangesOverlap(
      nextBounds.y,
      getWindowBottom(nextBounds),
      candidate.y,
      candidateBottom
    );
    const horizontalOverlap = rangesOverlap(
      nextBounds.x,
      getWindowRight(nextBounds),
      candidate.x,
      candidateRight
    );

    xCandidates.push(candidate.x, candidateRight - nextBounds.width);
    yCandidates.push(candidate.y, candidateBottom - nextBounds.height);

    if (verticalOverlap) {
      xCandidates.push(candidateRight, candidate.x - nextBounds.width);
    }

    if (horizontalOverlap) {
      yCandidates.push(candidateBottom, candidate.y - nextBounds.height);
    }
  });

  return clampBoundsToWorkArea(
    {
    x: pickClosestSnapCoordinate(nextBounds.x, xCandidates),
    y: pickClosestSnapCoordinate(nextBounds.y, yCandidates),
    width: nextBounds.width,
    height: nextBounds.height
    },
    workArea
  );
}

function writeDevInstanceFile(): void {
  if (app.isPackaged || IS_RELEASE_VERIFY) {
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
  if (app.isPackaged || IS_RELEASE_VERIFY || !fs.existsSync(DEV_INSTANCE_FILE)) {
    return;
  }

  try {
    fs.unlinkSync(DEV_INSTANCE_FILE);
  } catch (error) {
    console.error(error);
  }
}

function writeReleaseVerifyFile(window: StickyBrowserWindow): void {
  if (!IS_RELEASE_VERIFY) {
    return;
  }

  fs.writeFileSync(
    RELEASE_VERIFY_FILE,
    JSON.stringify({
      pid: process.pid,
      verifiedAt: Date.now(),
      bounds: window.getBounds()
    })
  );
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

function createDefaultReaderBounds(): Rectangle {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
}

function getReaderViewOrThrow(window: StickyBrowserWindow): WebContentsView {
  if (!window.readerView) {
    throw new Error("No reader view");
  }

  return window.readerView;
}

function getReaderWebContentsOrThrow(window: StickyBrowserWindow): WebContents {
  return getReaderViewOrThrow(window).webContents;
}

function canReaderGoBack(contents: WebContents | null | undefined): boolean {
  return contents?.navigationHistory.canGoBack() ?? false;
}

function canReaderGoForward(contents: WebContents | null | undefined): boolean {
  return contents?.navigationHistory.canGoForward() ?? false;
}

function isAbortedNavigationFailure(errorCode: number, errorDescription: string): boolean {
  return errorCode === -3 || /aborted/i.test(String(errorDescription || ""));
}

function isAbortedNavigationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; errno?: number; message?: string };
  const message = String(candidate.message || "");
  const isReleaseVerifyFailure = IS_RELEASE_VERIFY && (candidate.code === "ERR_FAILED" || candidate.errno === -2);
  return (
    isReleaseVerifyFailure ||
    candidate.code === "ERR_ABORTED" ||
    candidate.errno === -3 ||
    message.includes("ERR_ABORTED") ||
    message.includes("(-3) loading")
  );
}

function getReaderSnapshot(window: StickyBrowserWindow): Omit<ReaderEventPayload, "type" | "errorCode" | "errorDescription"> {
  const contents = window.readerView?.webContents ?? null;
  return {
    url: contents?.getURL() ?? "",
    title: contents?.getTitle() ?? "",
    canGoBack: canReaderGoBack(contents),
    canGoForward: canReaderGoForward(contents),
    loading: Boolean(window.readerLoading)
  };
}

function sendReaderEvent(
  window: StickyBrowserWindow,
  type: ReaderEventType,
  extra: Partial<Pick<ReaderEventPayload, "errorCode" | "errorDescription">> = {}
): void {
  if (window.isDestroyed()) {
    return;
  }

  const payload: ReaderEventPayload = {
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

function setReaderBounds(window: StickyBrowserWindow, bounds: Rectangle): void {
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

function setReaderVisibility(window: StickyBrowserWindow, visible: boolean): void {
  window.readerVisible = visible;

  if (!window.readerView) {
    return;
  }

  const bounds = window.readerBounds ?? createDefaultReaderBounds();
  window.readerView.setVisible(visible && bounds.width > 0 && bounds.height > 0);
}

function createReaderView(window: StickyBrowserWindow): void {
  const readerView = new WebContentsView({
    webPreferences: {
      partition: READER_PARTITION,
      preload: path.join(APP_ROOT, "renderer", "reader-preload.js"),
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
    void shell.openExternal(url);
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
        spellcheck: false
      }
    })
  );

  createReaderView(window);
  window.loadFile(path.join(APP_ROOT, "renderer", "index.html"));

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
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

function isReaderBoundsPayload(value: unknown): value is ReaderBoundsPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<ReaderBoundsPayload>;
  return (
    typeof payload.x === "number" &&
    typeof payload.y === "number" &&
    typeof payload.width === "number" &&
    typeof payload.height === "number"
  );
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

async function handleSnapWindowPosition(event: IpcMainInvokeEvent, value: unknown): Promise<Rectangle | null> {
  const window = BrowserWindow.fromWebContents(event.sender);
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
  } catch (error) {
    appendSnapLog("snap-window-error", {
      requested: value,
      message: error instanceof Error ? error.message : String(error)
    });
    return window.getBounds();
  }
}

function handleSetReaderBounds(event: IpcMainEvent, value: unknown): void {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || !isReaderBoundsPayload(value)) {
    return;
  }

  setReaderBounds(asStickyWindow(window), value);
}

function handleSetReaderVisibility(event: IpcMainEvent, value: unknown): void {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || typeof value !== "boolean") {
    return;
  }

  setReaderVisibility(asStickyWindow(window), value);
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

function handleReaderNavigate(event: IpcMainEvent, url: unknown): void {
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

    window.readerLoading = false;
    appendReaderLog("navigate-error", {
      url,
      message: error instanceof Error ? error.message : String(error)
    });
    sendReaderEvent(window, "did-fail-load", {
      errorCode: -2,
      errorDescription: error instanceof Error ? error.message : String(error)
    });
    console.error(error);
  });
}

function handleReaderReload(event: IpcMainEvent): void {
  getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender)).reload();
}

function handleReaderGoBack(event: IpcMainEvent): void {
  const readerContents = getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender));
  if (canReaderGoBack(readerContents)) {
    readerContents.goBack();
  }
}

function handleReaderGoForward(event: IpcMainEvent): void {
  const readerContents = getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender));
  if (canReaderGoForward(readerContents)) {
    readerContents.goForward();
  }
}

async function handleReaderInsertCss(event: IpcMainInvokeEvent, css: unknown): Promise<string | null> {
  if (typeof css !== "string" || !css) {
    return null;
  }

  return getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender)).insertCSS(css);
}

async function handleReaderRemoveInsertedCss(event: IpcMainInvokeEvent, key: unknown): Promise<void> {
  if (typeof key !== "string" || !key) {
    return;
  }

  await getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender)).removeInsertedCSS(key);
}

async function handleReaderExecuteJavaScript(
  event: IpcMainInvokeEvent,
  code: unknown,
  userGesture: unknown
): Promise<unknown> {
  if (typeof code !== "string" || !code) {
    return null;
  }

  return getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender)).executeJavaScript(code, Boolean(userGesture));
}

async function handleReaderToggleDevTools(event: IpcMainInvokeEvent): Promise<boolean> {
  const readerContents = getReaderWebContentsOrThrow(getSenderWindowOrThrow(event.sender));
  if (readerContents.isDevToolsOpened()) {
    readerContents.closeDevTools();
    return false;
  }

  readerContents.openDevTools({ mode: "detach", activate: true });
  return true;
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
    ipcMain.handle("window:snap-position", handleSnapWindowPosition);
    ipcMain.on("reader:set-bounds", handleSetReaderBounds);
    ipcMain.on("reader:set-visible", handleSetReaderVisibility);
    ipcMain.on("reader:navigate", handleReaderNavigate);
    ipcMain.on("reader:reload", handleReaderReload);
    ipcMain.on("reader:go-back", handleReaderGoBack);
    ipcMain.on("reader:go-forward", handleReaderGoForward);
    ipcMain.handle("window:toggle-collapsed", handleToggleCollapsed);
    ipcMain.handle("window:toggle-always-on-top", handleToggleAlwaysOnTop);
    ipcMain.handle("window:get-state", handleGetWindowState);
    ipcMain.handle("window:get-bounds", handleGetWindowBounds);
    ipcMain.handle("reader:insert-css", handleReaderInsertCss);
    ipcMain.handle("reader:remove-inserted-css", handleReaderRemoveInsertedCss);
    ipcMain.handle("reader:execute-javascript", handleReaderExecuteJavaScript);
    ipcMain.handle("reader:toggle-devtools", handleReaderToggleDevTools);

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
